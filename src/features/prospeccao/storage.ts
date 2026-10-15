export type ProspeccaoFilters = {
  uf?: string;
  cidade?: string;
  dias: number;
  cnae: string;
  revelarContatos: boolean;
};

export const DEFAULT_PROSPECCAO_FILTERS: ProspeccaoFilters = { dias: 30, cnae: "", revelarContatos: false };
