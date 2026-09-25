import { create } from "zustand";

type UIState = {
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
  createTaskOpen: boolean;
  setCreateTaskOpen: (open: boolean) => void;
  createProjectOpen: boolean;
  setCreateProjectOpen: (open: boolean) => void;
  createMeetingOpen: boolean;
  setCreateMeetingOpen: (open: boolean) => void;
  activeTaskId: string | null;
  setActiveTaskId: (id: string | null) => void;
};

export const useUIStore = create<UIState>((set) => ({
  commandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  createTaskOpen: false,
  setCreateTaskOpen: (open) => set({ createTaskOpen: open }),
  createProjectOpen: false,
  setCreateProjectOpen: (open) => set({ createProjectOpen: open }),
  createMeetingOpen: false,
  setCreateMeetingOpen: (open) => set({ createMeetingOpen: open }),
  activeTaskId: null,
  setActiveTaskId: (id) => set({ activeTaskId: id }),
}));
