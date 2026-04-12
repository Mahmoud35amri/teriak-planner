import { Lot, Schedule } from "../data/types";
import { dispatch } from "./engine";

type Chromosome = number[]; // indices into the lots array

function shuffled(n: number): Chromosome {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function evaluate(chromosome: Chromosome, lots: Lot[]): number {
  const ordered = chromosome.map((i) => lots[i]);
  return dispatch(ordered, "GA_OPTIMIZED").makespan;
}

// Tournament selection (k=3)
function tournament(population: Chromosome[], fitnesses: number[]): Chromosome {
  const a = Math.floor(Math.random() * population.length);
  const b = Math.floor(Math.random() * population.length);
  const c = Math.floor(Math.random() * population.length);
  const best = [a, b, c].reduce((x, y) => (fitnesses[x] < fitnesses[y] ? x : y));
  return [...population[best]];
}

// Order Crossover (OX)
function oxCrossover(p1: Chromosome, p2: Chromosome): Chromosome {
  const n = p1.length;
  const lo = Math.floor(Math.random() * n);
  const hi = lo + Math.floor(Math.random() * (n - lo));
  const segment = p1.slice(lo, hi + 1);
  const segSet = new Set(segment);
  const remaining = p2.filter((g) => !segSet.has(g));
  const child = new Array<number>(n);
  for (let i = lo; i <= hi; i++) child[i] = segment[i - lo];
  let ri = 0;
  for (let i = 0; i < n; i++) {
    if (i < lo || i > hi) child[i] = remaining[ri++];
  }
  return child;
}

// Swap mutation
function mutate(chromosome: Chromosome): Chromosome {
  const n = chromosome.length;
  const i = Math.floor(Math.random() * n);
  const j = Math.floor(Math.random() * n);
  const next = [...chromosome];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export interface GAResult {
  schedule: Schedule;
  baselineMakespan: number;
  improvementPct: number;
}

/**
 * Genetic Algorithm optimizer.
 * baselineMakespan: makespan of the reference heuristic (EDD) used to compute improvement %.
 */
export function runGA(
  lots: Lot[],
  baselineMakespan: number,
  populationSize = 50,
  maxGenerations = 100,
  mutationRate = 0.15
): GAResult {
  const n = lots.length;

  if (n === 0) {
    const schedule = dispatch([], "GA_OPTIMIZED");
    return { schedule, baselineMakespan: 0, improvementPct: 0 };
  }

  // Initialize random population
  let population: Chromosome[] = Array.from({ length: populationSize }, () => shuffled(n));
  let fitnesses = population.map((c) => evaluate(c, lots));

  let bestIdx = fitnesses.indexOf(Math.min(...fitnesses));
  let bestChromosome = [...population[bestIdx]];
  let bestFitness = fitnesses[bestIdx];

  for (let gen = 0; gen < maxGenerations; gen++) {
    const nextPop: Chromosome[] = [[...bestChromosome]]; // elitism: carry best forward

    while (nextPop.length < populationSize) {
      const p1 = tournament(population, fitnesses);
      const p2 = tournament(population, fitnesses);
      let child = oxCrossover(p1, p2);
      if (Math.random() < mutationRate) child = mutate(child);
      nextPop.push(child);
    }

    population = nextPop;
    fitnesses = population.map((c) => evaluate(c, lots));

    const genBest = fitnesses.indexOf(Math.min(...fitnesses));
    if (fitnesses[genBest] < bestFitness) {
      bestFitness = fitnesses[genBest];
      bestChromosome = [...population[genBest]];
    }
  }

  const orderedLots = bestChromosome.map((i) => lots[i]);
  const schedule = dispatch(orderedLots, "GA_OPTIMIZED");
  const improvementPct =
    baselineMakespan > 0
      ? Math.max(0, ((baselineMakespan - schedule.makespan) / baselineMakespan) * 100)
      : 0;

  return {
    schedule: { ...schedule, gaImprovement: improvementPct },
    baselineMakespan,
    improvementPct,
  };
}
