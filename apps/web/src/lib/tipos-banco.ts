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
      data_base_beneficios: {
        Row: {
          ano: number;
          beneficio_id: string;
          valor: number;
        };
        ComputedFields: never;
        Insert: {
          ano: number;
          beneficio_id: string;
          valor: number;
        };
        Update: {
          ano?: number;
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
          funcao_id: string;
          valor: number;
        };
        ComputedFields: never;
        Insert: {
          ano: number;
          funcao_id: string;
          valor: number;
        };
        Update: {
          ano?: number;
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
      feriados_empresa: {
        Row: {
          data: string;
          nome: string;
        };
        ComputedFields: never;
        Insert: {
          data: string;
          nome: string;
        };
        Update: {
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
      [_ in never]: never;
    };
    Functions: {
      criar_data_base: {
        Args: { p_ano: number; p_origem: number; p_reajuste_pct: number };
        Returns: number;
      };
      meu_perfil: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Enums"]["perfil"];
      };
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
      tipo_rubrica: ["provento", "desconto", "informativo"],
      vinculo: ["clt", "estagio"],
    },
  },
} as const;
