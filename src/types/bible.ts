export type Testamento = "antiguo" | "nuevo" | (string & {});

export type BibleItem = {
  id: number;
  libro: string;
  capitulo: number;
  versiculo_inicial: number;
  versiculo_final: number;
  texto: string;
  testamento: Testamento;
};