import type { Category } from '@vandelay/kernel';
import { create } from 'zustand';

interface AppState {
  category: Category;
  setCategory: (category: Category) => void;
}

export const useApp = create<AppState>()((set) => ({
  category: 'home',
  setCategory: (category) => set({ category }),
}));
