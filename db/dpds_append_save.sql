create or replace function public.dpds_append_save(p_id uuid,p_parent uuid,p_entry jsonb)
returns uuid language plpgsql security invoker set search_path='' as $$
declare latest uuid;
begin
  perform pg_advisory_xact_lock(437701,1);
  if exists(select 1 from public.dpds_uploads where id=p_id) then return p_id; end if;
  select id into latest from public.dpds_uploads where is_active order by uploaded_at desc,id desc limit 1;
  if p_parent is distinct from latest then
    raise exception '다른 저장본이 있습니다. 온라인 불러오기 후 변경을 적용해 주세요.';
  end if;
  if p_entry->'result'->>'format' not in ('dpds-base-v1','dpds-delta-v1') or not (p_entry->'result' ? 'format') then raise exception '저장 형식 오류'; end if;
  insert into public.dpds_uploads(id,file_name,file_path,current_month,sku_count,result,state,is_active,uploaded_at)
  values(p_id,p_entry->>'file_name',p_entry->>'file_path',(p_entry->>'current_month')::integer,(p_entry->>'sku_count')::integer,p_entry->'result',p_entry->'state',true,clock_timestamp());
  return p_id;
end $$;
