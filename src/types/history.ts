export type SavedFile = {
  path: string;      // UNC final
  savedAt: number;
};

export type HistoryEntry = {
  entryId: string;
  createdAt: number;

  passageId: number;
  libro: string;
  capitulo: number;
  versiculo_inicial: number;
  versiculo_final: number;
  testamento: string;
  texto: string;

  summaryTitulo: string;
  summaryDescripcion: string;

  songTitulo: string;
  songLetra: string;

  // ✅ solo lo que tú necesitas ahora
  saved?: {
    mp3?: SavedFile;
    srt?: SavedFile;
  };
};