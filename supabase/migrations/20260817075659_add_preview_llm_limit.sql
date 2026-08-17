alter table public.product_settings
  add column free_preview_llm_monthly_limit integer not null default 20,
  add constraint product_settings_preview_llm_limit_check
    check (free_preview_llm_monthly_limit between 1 and 100000);

comment on column public.product_settings.free_preview_llm_monthly_limit
is 'Per-user LLM request limit for each UTC calendar month while free preview is enabled.';
