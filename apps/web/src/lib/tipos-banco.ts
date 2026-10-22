export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: { extensions?: Json; operationName?: string; query?: string; variables?: Json };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      beneficios: {
        Row: {
          conta_pc: string;
          id: string;
          nome: string;
          ordem: number;
          so_fora_sede: boolean;
        };
        ComputedFields: never;
        Insert: {
          conta_pc?: string;
          id: string;
          nome: string;
          ordem?: number;
          so_fora_sede?: boolean;
        };
        Update: {
          conta_pc?: string;
          id?: string;
          nome?: string;
          ordem?: number;
          so_fora_sede?: boolean;
        };
        Relationships: [];
      };
      carga_rascunhos: {
        Row: {
          atualizado_em: string;
          criado_em: string;
          dados: NonNullable<Json>;
          etapa: number;
          id: string;
          leituras: Json | null;
          titulo: string;
          usuario_id: string;
        };
        ComputedFields: never;
        Insert: {
          atualizado_em?: string;
          criado_em?: string;
          dados?: NonNullable<Json>;
          etapa?: number;
          id?: string;
          leituras?: Json | null;
          titulo?: string;
          usuario_id?: string;
        };
        Update: {
          atualizado_em?: string;
          criado_em?: string;
          dados?: NonNullable<Json>;
          etapa?: number;
          id?: string;
          leituras?: Json | null;
          titulo?: string;
          usuario_id?: string;
        };
        Relationships: [];
      };
      cct_beneficios: {
        Row: {
          beneficio_id: string;
          cct_id: string;
          valor: number;
        };
        ComputedFields: never;
        Insert: {
          beneficio_id: string;
          cct_id: string;
          valor: number;
        };
        Update: {
          beneficio_id?: string;
          cct_id?: string;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: "cct_beneficios_beneficio_id_fkey";
            columns: ["beneficio_id"];
            isOneToOne: false;
            referencedRelation: "beneficios";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cct_beneficios_cct_id_fkey";
            columns: ["cct_id"];
            isOneToOne: false;
            referencedRelation: "ccts";
            referencedColumns: ["id"];
          },
        ];
      };
      cct_gratificacoes: {
        Row: {
          cct_id: string;
          funcao_id: string;
          valor: number;
        };
        ComputedFields: never;
        Insert: {
          cct_id: string;
          funcao_id: string;
          valor: number;
        };
        Update: {
          cct_id?: string;
          funcao_id?: string;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: "cct_gratificacoes_cct_id_fkey";
            columns: ["cct_id"];
            isOneToOne: false;
            referencedRelation: "ccts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cct_gratificacoes_funcao_id_fkey";
            columns: ["funcao_id"];
            isOneToOne: false;
            referencedRelation: "funcoes";
            referencedColumns: ["id"];
          },
        ];
      };
      cct_salarios: {
        Row: {
          cct_id: string;
          funcao_id: string;
          valor: number;
        };
        ComputedFields: never;
        Insert: {
          cct_id: string;
          funcao_id: string;
          valor: number;
        };
        Update: {
          cct_id?: string;
          funcao_id?: string;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: "cct_salarios_cct_id_fkey";
            columns: ["cct_id"];
            isOneToOne: false;
            referencedRelation: "ccts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cct_salarios_funcao_id_fkey";
            columns: ["funcao_id"];
            isOneToOne: false;
            referencedRelation: "funcoes";
            referencedColumns: ["id"];
          },
        ];
      };
      ccts: {
        Row: {
          atualizado_em: string;
          atualizado_por: string | null;
          id: string;
          mes_data_base: number;
          nome: string;
          reajuste_estimado_pct: number;
        };
        ComputedFields: never;
        Insert: {
          atualizado_em?: string;
          atualizado_por?: string | null;
          id: string;
          mes_data_base?: number;
          nome: string;
          reajuste_estimado_pct?: number;
        };
        Update: {
          atualizado_em?: string;
          atualizado_por?: string | null;
          id?: string;
          mes_data_base?: number;
          nome?: string;
          reajuste_estimado_pct?: number;
        };
        Relationships: [];
      };
      cidade_feriados: {
        Row: {
          cidade_id: string;
          dia: number;
          mes: number;
          nome: string;
        };
        ComputedFields: never;
        Insert: {
          cidade_id: string;
          dia: number;
          mes: number;
          nome: string;
        };
        Update: {
          cidade_id?: string;
          dia?: number;
          mes?: number;
          nome?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cidade_feriados_cidade_id_fkey";
            columns: ["cidade_id"];
            isOneToOne: false;
            referencedRelation: "cidades";
            referencedColumns: ["id"];
          },
        ];
      };
      cidade_passagens: {
        Row: {
          cidade_id: string;
          origem_id: string;
          valor: number;
        };
        ComputedFields: never;
        Insert: {
          cidade_id: string;
          origem_id: string;
          valor: number;
        };
        Update: {
          cidade_id?: string;
          origem_id?: string;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: "cidade_passagens_cidade_id_fkey";
            columns: ["cidade_id"];
            isOneToOne: false;
            referencedRelation: "cidades";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cidade_passagens_origem_id_fkey";
            columns: ["origem_id"];
            isOneToOne: false;
            referencedRelation: "cidades";
            referencedColumns: ["id"];
          },
        ];
      };
      cidades: {
        Row: {
          atualizado_em: string;
          atualizado_por: string | null;
          cct_id: string;
          conducoes: number;
          id: string;
          iss_pct: number;
          nome: string;
          tarifa_local: number;
          uf: string;
        };
        ComputedFields: never;
        Insert: {
          atualizado_em?: string;
          atualizado_por?: string | null;
          cct_id: string;
          conducoes?: number;
          id: string;
          iss_pct?: number;
          nome: string;
          tarifa_local?: number;
          uf: string;
        };
        Update: {
          atualizado_em?: string;
          atualizado_por?: string | null;
          cct_id?: string;
          conducoes?: number;
          id?: string;
          iss_pct?: number;
          nome?: string;
          tarifa_local?: number;
          uf?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cidades_cct_id_fkey";
            columns: ["cct_id"];
            isOneToOne: false;
            referencedRelation: "ccts";
            referencedColumns: ["id"];
          },
        ];
      };
      competencias: {
        Row: {
          absenteismo_pct: number;
          erp_realizado: number | null;
          ferias_pessoa_dias: number;
          he_media: number;
          ito_apropriado: number | null;
          justificativa: string | null;
          licenca_pessoa_dias: number;
          mes_idx: number;
          obra_id: string;
        };
        ComputedFields: never;
        Insert: {
          absenteismo_pct?: number;
          erp_realizado?: number | null;
          ferias_pessoa_dias?: number;
          he_media?: number;
          ito_apropriado?: number | null;
          justificativa?: string | null;
          licenca_pessoa_dias?: number;
          mes_idx: number;
          obra_id: string;
        };
        Update: {
          absenteismo_pct?: number;
          erp_realizado?: number | null;
          ferias_pessoa_dias?: number;
          he_media?: number;
          ito_apropriado?: number | null;
          justificativa?: string | null;
          licenca_pessoa_dias?: number;
          mes_idx?: number;
          obra_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "competencias_justificativa_fkey";
            columns: ["justificativa"];
            isOneToOne: false;
            referencedRelation: "justificativas_erp";
            referencedColumns: ["texto"];
          },
          {
            foreignKeyName: "competencias_obra_id_fkey";
            columns: ["obra_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      data_base_beneficios: {
        Row: {
          ano: number;
          atualizado_em: string;
          atualizado_por: string | null;
          beneficio_id: string;
          valor: number;
        };
        ComputedFields: never;
        Insert: {
          ano: number;
          atualizado_em?: string;
          atualizado_por?: string | null;
          beneficio_id: string;
          valor: number;
        };
        Update: {
          ano?: number;
          atualizado_em?: string;
          atualizado_por?: string | null;
          beneficio_id?: string;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: "data_base_beneficios_ano_fkey";
            columns: ["ano"];
            isOneToOne: false;
            referencedRelation: "datas_base";
            referencedColumns: ["ano"];
          },
          {
            foreignKeyName: "data_base_beneficios_beneficio_id_fkey";
            columns: ["beneficio_id"];
            isOneToOne: false;
            referencedRelation: "beneficios";
            referencedColumns: ["id"];
          },
        ];
      };
      data_base_encargos: {
        Row: {
          aliq_clt: number;
          aliq_sp: number;
          ano: number;
          atualizado_em: string;
          atualizado_por: string | null;
          base_calc_pct: number;
          grupo: Database["public"]["Enums"]["grupo_encargo"];
          id: string;
          nome: string;
          ordem: number;
        };
        ComputedFields: never;
        Insert: {
          aliq_clt?: number;
          aliq_sp?: number;
          ano: number;
          atualizado_em?: string;
          atualizado_por?: string | null;
          base_calc_pct?: number;
          grupo: Database["public"]["Enums"]["grupo_encargo"];
          id: string;
          nome: string;
          ordem?: number;
        };
        Update: {
          aliq_clt?: number;
          aliq_sp?: number;
          ano?: number;
          atualizado_em?: string;
          atualizado_por?: string | null;
          base_calc_pct?: number;
          grupo?: Database["public"]["Enums"]["grupo_encargo"];
          id?: string;
          nome?: string;
          ordem?: number;
        };
        Relationships: [
          {
            foreignKeyName: "data_base_encargos_ano_fkey";
            columns: ["ano"];
            isOneToOne: false;
            referencedRelation: "datas_base";
            referencedColumns: ["ano"];
          },
        ];
      };
      data_base_salarios: {
        Row: {
          ano: number;
          atualizado_em: string;
          atualizado_por: string | null;
          funcao_id: string;
          valor: number;
        };
        ComputedFields: never;
        Insert: {
          ano: number;
          atualizado_em?: string;
          atualizado_por?: string | null;
          funcao_id: string;
          valor: number;
        };
        Update: {
          ano?: number;
          atualizado_em?: string;
          atualizado_por?: string | null;
          funcao_id?: string;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: "data_base_salarios_ano_fkey";
            columns: ["ano"];
            isOneToOne: false;
            referencedRelation: "datas_base";
            referencedColumns: ["ano"];
          },
          {
            foreignKeyName: "data_base_salarios_funcao_id_fkey";
            columns: ["funcao_id"];
            isOneToOne: false;
            referencedRelation: "funcoes";
            referencedColumns: ["id"];
          },
        ];
      };
      datas_base: {
        Row: {
          a_revisar: boolean;
          adicional_noturno_pct: number;
          ano: number;
          atualizado_em: string;
          atualizado_por: string | null;
          criado_de: number | null;
          dias_fixos: number;
          divisor: number;
          dsr_fixo_pct: number;
          fator_rescisao: number;
          he_adicional_feriado: number;
          he_adicional_intervalo: number;
          he_adicional_sabado: number;
          he_adicional_util: number;
          modo_dias: Database["public"]["Enums"]["modo_dias"];
          reajuste_pct: number | null;
          sabado_trabalhado: boolean;
          salario_minimo: number;
          sf_cota: number;
          sf_teto: number;
          vt_diaria_ref: number;
        };
        ComputedFields: never;
        Insert: {
          a_revisar?: boolean;
          adicional_noturno_pct?: number;
          ano: number;
          atualizado_em?: string;
          atualizado_por?: string | null;
          criado_de?: number | null;
          dias_fixos?: number;
          divisor?: number;
          dsr_fixo_pct?: number;
          fator_rescisao?: number;
          he_adicional_feriado?: number;
          he_adicional_intervalo?: number;
          he_adicional_sabado?: number;
          he_adicional_util?: number;
          modo_dias?: Database["public"]["Enums"]["modo_dias"];
          reajuste_pct?: number | null;
          sabado_trabalhado?: boolean;
          salario_minimo?: number;
          sf_cota?: number;
          sf_teto?: number;
          vt_diaria_ref?: number;
        };
        Update: {
          a_revisar?: boolean;
          adicional_noturno_pct?: number;
          ano?: number;
          atualizado_em?: string;
          atualizado_por?: string | null;
          criado_de?: number | null;
          dias_fixos?: number;
          divisor?: number;
          dsr_fixo_pct?: number;
          fator_rescisao?: number;
          he_adicional_feriado?: number;
          he_adicional_intervalo?: number;
          he_adicional_sabado?: number;
          he_adicional_util?: number;
          modo_dias?: Database["public"]["Enums"]["modo_dias"];
          reajuste_pct?: number | null;
          sabado_trabalhado?: boolean;
          salario_minimo?: number;
          sf_cota?: number;
          sf_teto?: number;
          vt_diaria_ref?: number;
        };
        Relationships: [
          {
            foreignKeyName: "datas_base_criado_de_fkey";
            columns: ["criado_de"];
            isOneToOne: false;
            referencedRelation: "datas_base";
            referencedColumns: ["ano"];
          },
        ];
      };
      efetivo_mes: {
        Row: {
          admissoes: number;
          cabecas: number;
          desligamentos: number;
          equivalente: number;
          funcao_id: string;
          mes_idx: number;
          obra_id: string;
        };
        ComputedFields: never;
        Insert: {
          admissoes?: number;
          cabecas: number;
          desligamentos?: number;
          equivalente: number;
          funcao_id: string;
          mes_idx: number;
          obra_id: string;
        };
        Update: {
          admissoes?: number;
          cabecas?: number;
          desligamentos?: number;
          equivalente?: number;
          funcao_id?: string;
          mes_idx?: number;
          obra_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "efetivo_mes_funcao_id_fkey";
            columns: ["funcao_id"];
            isOneToOne: false;
            referencedRelation: "funcoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "efetivo_mes_obra_id_fkey";
            columns: ["obra_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      erp_realizado: {
        Row: {
          conta: string;
          mes_idx: number;
          obra_id: string;
          valor: number;
        };
        ComputedFields: never;
        Insert: {
          conta: string;
          mes_idx: number;
          obra_id: string;
          valor: number;
        };
        Update: {
          conta?: string;
          mes_idx?: number;
          obra_id?: string;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: "erp_realizado_obra_id_fkey";
            columns: ["obra_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      feriados_empresa: {
        Row: {
          atualizado_em: string;
          atualizado_por: string | null;
          data: string;
          nome: string;
        };
        ComputedFields: never;
        Insert: {
          atualizado_em?: string;
          atualizado_por?: string | null;
          data: string;
          nome: string;
        };
        Update: {
          atualizado_em?: string;
          atualizado_por?: string | null;
          data?: string;
          nome?: string;
        };
        Relationships: [];
      };
      funcao_sinonimos: {
        Row: {
          funcao_id: string;
          texto: string;
        };
        ComputedFields: never;
        Insert: {
          funcao_id: string;
          texto: string;
        };
        Update: {
          funcao_id?: string;
          texto?: string;
        };
        Relationships: [
          {
            foreignKeyName: "funcao_sinonimos_funcao_id_fkey";
            columns: ["funcao_id"];
            isOneToOne: false;
            referencedRelation: "funcoes";
            referencedColumns: ["id"];
          },
        ];
      };
      funcoes: {
        Row: {
          ativo: boolean;
          atualizado_em: string;
          atualizado_por: string | null;
          conta_pc: string;
          cor: string;
          escala_area: boolean;
          exame_adm: number;
          exame_dem: number;
          exame_per_anual: number;
          fator_he: number;
          ferramentas_mes: number;
          grupo: Database["public"]["Enums"]["grupo_funcao"];
          horas_noturnas_mes: number;
          id: string;
          insal_pct_sm: number;
          nome: string;
          peric_pct: number;
          vinculo: Database["public"]["Enums"]["vinculo"];
        };
        ComputedFields: never;
        Insert: {
          ativo?: boolean;
          atualizado_em?: string;
          atualizado_por?: string | null;
          conta_pc?: string;
          cor?: string;
          escala_area?: boolean;
          exame_adm?: number;
          exame_dem?: number;
          exame_per_anual?: number;
          fator_he?: number;
          ferramentas_mes?: number;
          grupo: Database["public"]["Enums"]["grupo_funcao"];
          horas_noturnas_mes?: number;
          id: string;
          insal_pct_sm?: number;
          nome: string;
          peric_pct?: number;
          vinculo?: Database["public"]["Enums"]["vinculo"];
        };
        Update: {
          ativo?: boolean;
          atualizado_em?: string;
          atualizado_por?: string | null;
          conta_pc?: string;
          cor?: string;
          escala_area?: boolean;
          exame_adm?: number;
          exame_dem?: number;
          exame_per_anual?: number;
          fator_he?: number;
          ferramentas_mes?: number;
          grupo?: Database["public"]["Enums"]["grupo_funcao"];
          horas_noturnas_mes?: number;
          id?: string;
          insal_pct_sm?: number;
          nome?: string;
          peric_pct?: number;
          vinculo?: Database["public"]["Enums"]["vinculo"];
        };
        Relationships: [];
      };
      justificativas_erp: {
        Row: {
          ordem: number;
          texto: string;
        };
        ComputedFields: never;
        Insert: {
          ordem?: number;
          texto: string;
        };
        Update: {
          ordem?: number;
          texto?: string;
        };
        Relationships: [];
      };
      lancamento_rubricas: {
        Row: {
          funcao_id: string;
          matricula: string;
          mes_idx: number;
          obra_id: string;
          referencia: number;
          rubrica_codigo: number;
          valor: number;
        };
        ComputedFields: never;
        Insert: {
          funcao_id: string;
          matricula: string;
          mes_idx: number;
          obra_id: string;
          referencia?: number;
          rubrica_codigo: number;
          valor: number;
        };
        Update: {
          funcao_id?: string;
          matricula?: string;
          mes_idx?: number;
          obra_id?: string;
          referencia?: number;
          rubrica_codigo?: number;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: "lancamento_rubricas_obra_id_mes_idx_matricula_funcao_id_fkey";
            columns: ["obra_id", "mes_idx", "matricula", "funcao_id"];
            isOneToOne: false;
            referencedRelation: "lancamentos";
            referencedColumns: ["obra_id", "mes_idx", "matricula", "funcao_id"];
          },
          {
            foreignKeyName: "lancamento_rubricas_rubrica_codigo_fkey";
            columns: ["rubrica_codigo"];
            isOneToOne: false;
            referencedRelation: "rubricas";
            referencedColumns: ["codigo"];
          },
        ];
      };
      lancamentos: {
        Row: {
          admitido: boolean;
          desligado: boolean;
          equivalente: number;
          faltas_horas: number;
          ferias_dias: number;
          funcao_id: string;
          horas_extras: number;
          licenca_dias: number;
          matricula: string;
          mes_idx: number;
          obra_id: string;
          realocada_para: string | null;
          sem_vt: boolean;
          vt_valor: number | null;
        };
        ComputedFields: never;
        Insert: {
          admitido?: boolean;
          desligado?: boolean;
          equivalente: number;
          faltas_horas?: number;
          ferias_dias?: number;
          funcao_id: string;
          horas_extras?: number;
          licenca_dias?: number;
          matricula: string;
          mes_idx: number;
          obra_id: string;
          realocada_para?: string | null;
          sem_vt?: boolean;
          vt_valor?: number | null;
        };
        Update: {
          admitido?: boolean;
          desligado?: boolean;
          equivalente?: number;
          faltas_horas?: number;
          ferias_dias?: number;
          funcao_id?: string;
          horas_extras?: number;
          licenca_dias?: number;
          matricula?: string;
          mes_idx?: number;
          obra_id?: string;
          realocada_para?: string | null;
          sem_vt?: boolean;
          vt_valor?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "lancamentos_funcao_id_fkey";
            columns: ["funcao_id"];
            isOneToOne: false;
            referencedRelation: "funcoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lancamentos_obra_id_fkey";
            columns: ["obra_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      notas_fiscais: {
        Row: {
          cofins: number;
          csll: number;
          inss: number;
          ir: number;
          iss: number;
          mes_idx: number;
          numero: string;
          obra_id: string;
          pis: number;
          prestador_cnpj: string;
          valor: number;
        };
        ComputedFields: never;
        Insert: {
          cofins?: number;
          csll?: number;
          inss?: number;
          ir?: number;
          iss?: number;
          mes_idx: number;
          numero: string;
          obra_id: string;
          pis?: number;
          prestador_cnpj: string;
          valor: number;
        };
        Update: {
          cofins?: number;
          csll?: number;
          inss?: number;
          ir?: number;
          iss?: number;
          mes_idx?: number;
          numero?: string;
          obra_id?: string;
          pis?: number;
          prestador_cnpj?: string;
          valor?: number;
        };
        Relationships: [
          {
            foreignKeyName: "notas_fiscais_obra_id_fkey";
            columns: ["obra_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_feriados: {
        Row: {
          data: string;
          nome: string;
          obra_id: string;
        };
        ComputedFields: never;
        Insert: {
          data: string;
          nome: string;
          obra_id: string;
        };
        Update: {
          data?: string;
          nome?: string;
          obra_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "obra_feriados_obra_id_fkey";
            columns: ["obra_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_regime: {
        Row: {
          funcao_id: string;
          obra_id: string;
          regime: Database["public"]["Enums"]["regime"];
        };
        ComputedFields: never;
        Insert: {
          funcao_id: string;
          obra_id: string;
          regime: Database["public"]["Enums"]["regime"];
        };
        Update: {
          funcao_id?: string;
          obra_id?: string;
          regime?: Database["public"]["Enums"]["regime"];
        };
        Relationships: [
          {
            foreignKeyName: "obra_regime_funcao_id_fkey";
            columns: ["funcao_id"];
            isOneToOne: false;
            referencedRelation: "funcoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obra_regime_obra_id_fkey";
            columns: ["obra_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_resumo: {
        Row: {
          atualizado_em: string;
          contexto: string;
          custo_atual: number;
          custo_epoca: number;
          he_por_pessoa: number;
          histograma: number[];
          indireta_pct: number;
          obra_id: string;
          pessoa_mes: number;
          pico: number;
          revisao: number;
          versao: number;
          vigente: number;
        };
        ComputedFields: never;
        Insert: {
          atualizado_em?: string;
          contexto?: string;
          custo_atual?: number;
          custo_epoca?: number;
          he_por_pessoa?: number;
          histograma?: number[];
          indireta_pct?: number;
          obra_id: string;
          pessoa_mes?: number;
          pico?: number;
          revisao?: number;
          versao?: number;
          vigente: number;
        };
        Update: {
          atualizado_em?: string;
          contexto?: string;
          custo_atual?: number;
          custo_epoca?: number;
          he_por_pessoa?: number;
          histograma?: number[];
          indireta_pct?: number;
          obra_id?: string;
          pessoa_mes?: number;
          pico?: number;
          revisao?: number;
          versao?: number;
          vigente?: number;
        };
        Relationships: [
          {
            foreignKeyName: "obra_resumo_obra_id_fkey";
            columns: ["obra_id"];
            isOneToOne: true;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obra_trocas_tabela: {
        Row: {
          data_base: number;
          mes_idx: number;
          motivo: string;
          obra_id: string;
        };
        ComputedFields: never;
        Insert: {
          data_base: number;
          mes_idx: number;
          motivo?: string;
          obra_id: string;
        };
        Update: {
          data_base?: number;
          mes_idx?: number;
          motivo?: string;
          obra_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "obra_trocas_tabela_data_base_fkey";
            columns: ["data_base"];
            isOneToOne: false;
            referencedRelation: "datas_base";
            referencedColumns: ["ano"];
          },
          {
            foreignKeyName: "obra_trocas_tabela_obra_id_fkey";
            columns: ["obra_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      obras: {
        Row: {
          adiantamento: boolean;
          adiantamento_pct: number;
          area_m2: number;
          carregada_em: string;
          carregada_por: string | null;
          cidade_id: string | null;
          cliente: string;
          data_base: number;
          fora_da_sede: boolean;
          funcoes_transferidas: string[];
          grat_premios_pct: number;
          grupo: string;
          he_mix_feriado: number;
          he_mix_intervalo: number;
          he_mix_sabado: number;
          he_mix_util: number;
          id: string;
          inicio: string;
          lucro_pct: number;
          meses: number;
          nome: string;
          provisionar: boolean;
          revisao: number;
          risco_pct: number;
          rotatividade_pct: number;
          tipologia: string;
          transf_pct: number;
          trib_lucro_pct: number;
        };
        ComputedFields: never;
        Insert: {
          adiantamento?: boolean;
          adiantamento_pct?: number;
          area_m2: number;
          carregada_em?: string;
          carregada_por?: string | null;
          cidade_id?: string | null;
          cliente?: string;
          data_base: number;
          fora_da_sede?: boolean;
          funcoes_transferidas?: string[];
          grat_premios_pct?: number;
          grupo?: string;
          he_mix_feriado?: number;
          he_mix_intervalo?: number;
          he_mix_sabado?: number;
          he_mix_util?: number;
          id: string;
          inicio: string;
          lucro_pct?: number;
          meses: number;
          nome: string;
          provisionar?: boolean;
          revisao?: number;
          risco_pct?: number;
          rotatividade_pct?: number;
          tipologia?: string;
          transf_pct?: number;
          trib_lucro_pct?: number;
        };
        Update: {
          adiantamento?: boolean;
          adiantamento_pct?: number;
          area_m2?: number;
          carregada_em?: string;
          carregada_por?: string | null;
          cidade_id?: string | null;
          cliente?: string;
          data_base?: number;
          fora_da_sede?: boolean;
          funcoes_transferidas?: string[];
          grat_premios_pct?: number;
          grupo?: string;
          he_mix_feriado?: number;
          he_mix_intervalo?: number;
          he_mix_sabado?: number;
          he_mix_util?: number;
          id?: string;
          inicio?: string;
          lucro_pct?: number;
          meses?: number;
          nome?: string;
          provisionar?: boolean;
          revisao?: number;
          risco_pct?: number;
          rotatividade_pct?: number;
          tipologia?: string;
          transf_pct?: number;
          trib_lucro_pct?: number;
        };
        Relationships: [
          {
            foreignKeyName: "obras_cidade_id_fkey";
            columns: ["cidade_id"];
            isOneToOne: false;
            referencedRelation: "cidades";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "obras_data_base_fkey";
            columns: ["data_base"];
            isOneToOne: false;
            referencedRelation: "datas_base";
            referencedColumns: ["ano"];
          },
        ];
      };
      parametros: {
        Row: {
          atualizado_em: string;
          atualizado_por: string | null;
          carnaval: boolean;
          corpus_christi: boolean;
          data_base_vigente: number | null;
          id: boolean;
        };
        ComputedFields: never;
        Insert: {
          atualizado_em?: string;
          atualizado_por?: string | null;
          carnaval?: boolean;
          corpus_christi?: boolean;
          data_base_vigente?: number | null;
          id?: boolean;
        };
        Update: {
          atualizado_em?: string;
          atualizado_por?: string | null;
          carnaval?: boolean;
          corpus_christi?: boolean;
          data_base_vigente?: number | null;
          id?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "parametros_data_base_vigente_fkey";
            columns: ["data_base_vigente"];
            isOneToOne: false;
            referencedRelation: "datas_base";
            referencedColumns: ["ano"];
          },
        ];
      };
      realocacoes: {
        Row: {
          funcao_id: string;
          id: number;
          mes_fim: number;
          mes_ini: number;
          obra_id: string;
          outra_obra: string;
          outra_obra_id: string | null;
          qtd: number;
          saldo_vt: number;
          tipo: Database["public"]["Enums"]["tipo_realocacao"];
        };
        ComputedFields: never;
        Insert: {
          funcao_id: string;
          id?: never;
          mes_fim: number;
          mes_ini: number;
          obra_id: string;
          outra_obra: string;
          outra_obra_id?: string | null;
          qtd: number;
          saldo_vt?: number;
          tipo: Database["public"]["Enums"]["tipo_realocacao"];
        };
        Update: {
          funcao_id?: string;
          id?: never;
          mes_fim?: number;
          mes_ini?: number;
          obra_id?: string;
          outra_obra?: string;
          outra_obra_id?: string | null;
          qtd?: number;
          saldo_vt?: number;
          tipo?: Database["public"]["Enums"]["tipo_realocacao"];
        };
        Relationships: [
          {
            foreignKeyName: "realocacoes_funcao_id_fkey";
            columns: ["funcao_id"];
            isOneToOne: false;
            referencedRelation: "funcoes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "realocacoes_obra_id_fkey";
            columns: ["obra_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "realocacoes_outra_obra_id_fkey";
            columns: ["outra_obra_id"];
            isOneToOne: false;
            referencedRelation: "obras";
            referencedColumns: ["id"];
          },
        ];
      };
      rubricas: {
        Row: {
          ativo: boolean;
          atualizado_em: string;
          atualizado_por: string | null;
          base_provisoes: boolean;
          codigo: number;
          componente: Database["public"]["Enums"]["componente_rubrica"];
          nome: string;
          tipo: Database["public"]["Enums"]["tipo_rubrica"];
          tipo_he: string | null;
        };
        ComputedFields: never;
        Insert: {
          ativo?: boolean;
          atualizado_em?: string;
          atualizado_por?: string | null;
          base_provisoes?: boolean;
          codigo: number;
          componente: Database["public"]["Enums"]["componente_rubrica"];
          nome: string;
          tipo: Database["public"]["Enums"]["tipo_rubrica"];
          tipo_he?: string | null;
        };
        Update: {
          ativo?: boolean;
          atualizado_em?: string;
          atualizado_por?: string | null;
          base_provisoes?: boolean;
          codigo?: number;
          componente?: Database["public"]["Enums"]["componente_rubrica"];
          nome?: string;
          tipo?: Database["public"]["Enums"]["tipo_rubrica"];
          tipo_he?: string | null;
        };
        Relationships: [];
      };
      usuarios: {
        Row: {
          admin: boolean;
          atualizado_em: string;
          criado_em: string;
          email: string;
          id: string;
          nome: string;
          perfil: Database["public"]["Enums"]["perfil"];
        };
        ComputedFields: never;
        Insert: {
          admin?: boolean;
          atualizado_em?: string;
          criado_em?: string;
          email: string;
          id: string;
          nome?: string;
          perfil?: Database["public"]["Enums"]["perfil"];
        };
        Update: {
          admin?: boolean;
          atualizado_em?: string;
          criado_em?: string;
          email?: string;
          id?: string;
          nome?: string;
          perfil?: Database["public"]["Enums"]["perfil"];
        };
        Relationships: [];
      };
    };
    Views: {
      funcao_obras: {
        Row: {
          funcao_id: string | null;
          obras: number | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "efetivo_mes_funcao_id_fkey";
            columns: ["funcao_id"];
            isOneToOne: false;
            referencedRelation: "funcoes";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      ajustar_cct: { Args: { p_cct: string; p_pct: number }; Returns: number };
      criar_cct: { Args: { p_id: string; p_nome: string }; Returns: string };
      criar_data_base: { Args: { p_ano: number; p_reajuste_pct: number }; Returns: number };
      criar_funcao: {
        Args: {
          p_grupo: Database["public"]["Enums"]["grupo_funcao"];
          p_id: string;
          p_nome: string;
          p_sinonimo?: string;
        };
        Returns: string;
      };
      data_base_editavel: { Args: { p_ano: number }; Returns: boolean };
      duplicar_cct: { Args: { p_id: string; p_nome: string; p_origem: string }; Returns: string };
      excluir_obra: { Args: { p_id: string }; Returns: undefined };
      exigir_carga: { Args: Record<PropertyKey, never>; Returns: undefined };
      exigir_config: { Args: Record<PropertyKey, never>; Returns: undefined };
      gravar_carga: { Args: { p: Json }; Returns: string };
      gravar_resumos: { Args: { p: Json }; Returns: number };
      meu_perfil: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Enums"]["perfil"];
      };
      pode_carregar: { Args: Record<PropertyKey, never>; Returns: boolean };
      pode_editar_cadastros: { Args: Record<PropertyKey, never>; Returns: boolean };
      pode_editar_config: { Args: Record<PropertyKey, never>; Returns: boolean };
      sou_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
    };
    Enums: {
      componente_rubrica:
        | "sal"
        | "extras"
        | "he"
        | "dsr"
        | "faltas"
        | "resc"
        | "ferr"
        | "provpaga"
        | "compgps"
        | "nao"
        | "info";
      grupo_encargo: "soc" | "prov" | "nf";
      grupo_funcao: "direta" | "indireta" | "adm";
      modo_dias: "calendario" | "fixo";
      perfil: "planejamento" | "engenharia" | "dp_rh" | "controladoria" | "diretoria";
      regime: "clt" | "sp";
      tipo_realocacao: "cedida" | "recebida";
      tipo_rubrica: "provento" | "desconto" | "informativo";
      vinculo: "clt" | "estagio";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      componente_rubrica: [
        "sal",
        "extras",
        "he",
        "dsr",
        "faltas",
        "resc",
        "ferr",
        "provpaga",
        "compgps",
        "nao",
        "info",
      ],
      grupo_encargo: ["soc", "prov", "nf"],
      grupo_funcao: ["direta", "indireta", "adm"],
      modo_dias: ["calendario", "fixo"],
      perfil: ["planejamento", "engenharia", "dp_rh", "controladoria", "diretoria"],
      regime: ["clt", "sp"],
      tipo_realocacao: ["cedida", "recebida"],
      tipo_rubrica: ["provento", "desconto", "informativo"],
      vinculo: ["clt", "estagio"],
    },
  },
} as const;
