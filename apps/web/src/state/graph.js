import { create } from 'zustand';
export const useGraphStore = create((set) => ({
    nodes: [],
    setRoot: (artist) => set({ nodes: [{ id: artist.id, artist }] })
}));
