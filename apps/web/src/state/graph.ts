import { create } from 'zustand';
import type { Artist } from '@musicdiscovery/shared';

export type GraphNode = {
  id: string;
  artist: Artist;
};

type GraphStore = {
  nodes: GraphNode[];
  setRoot: (artist: Artist) => void;
};

export const useGraphStore = create<GraphStore>((set) => ({
  nodes: [],
  setRoot: (artist) => set({ nodes: [{ id: artist.id, artist }] })
}));
