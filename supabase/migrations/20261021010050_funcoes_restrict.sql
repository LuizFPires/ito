-- Revisão de segurança do M1: DP/RH edita funções, mas não a tabela da empresa.
-- Com "on delete cascade", apagar uma função levaria junto os salários (dado de config).
-- Agora: função com salário não pode ser apagada (inative-a) e o id da função não muda.
alter table public.data_base_salarios drop constraint data_base_salarios_funcao_id_fkey;
alter table public.data_base_salarios
  add constraint data_base_salarios_funcao_id_fkey
  foreign key (funcao_id) references public.funcoes (id) on delete restrict on update restrict;

alter table public.funcao_sinonimos drop constraint funcao_sinonimos_funcao_id_fkey;
alter table public.funcao_sinonimos
  add constraint funcao_sinonimos_funcao_id_fkey
  foreign key (funcao_id) references public.funcoes (id) on delete cascade on update restrict;

create function public.funcoes_id_imutavel()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id is distinct from old.id then
    raise exception 'O código da função não pode mudar. Crie outra função e inative esta.'
      using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.funcoes_id_imutavel() from public, anon, authenticated;

create trigger funcoes_id_imutavel before update of id on public.funcoes
  for each row execute function public.funcoes_id_imutavel();
