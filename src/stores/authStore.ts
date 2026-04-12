"use client";

import { create } from "zustand";
import { Role } from "@/lib/auth/roles";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

interface AuthState {
  user: AuthUser | null;
  setUser: (user: AuthUser | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  setUser: (user) => set({ user }),
}));
