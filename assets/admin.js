"use strict";

const $ = selector => document.querySelector(selector);
const esc = value => String(value == null ? "" : value).replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
let dashboard = null;

function formatDate(value, includeTime) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("ru-RU", includeTime ? {day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"} : {day:"2-digit",month:"short",year:"numeric"});
}
function number(value) { return Number(value || 0).toLocaleString("ru-RU"); }
function dollars(value) { return "$"+Number(value || 0).toLocaleString("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:4}); }
function statusLabel(status) { return ({preview:"Бесплатный доступ",trialing:"Trial Max",active:"Активна",past_due:"Просрочка",canceled:"Отменена",missing:"Нет профиля"})[status] || status; }

function renderStats(summary) {
  const cards = [["Всего зарегистрировано",summary.total_users],["Активны за 7 дней",summary.active_7d],["Активны за 30 дней",summary.active_30d],["Бесплатный доступ",summary.statuses?.preview||0],["Активные подписки",summary.statuses?.active||0],["LLM-запросы за 30 дней",summary.llm_requests_30d],["Расчётный расход LLM за 30 дней",dollars(summary.llm_cost_30d_usd)]];
  $("#adminStats").innerHTML = cards.map(card => "<div class='admin-stat'><span>"+esc(card[0])+"</span><b>"+(typeof card[1]==="string"?esc(card[1]):number(card[1]))+"</b></div>").join("");
  $("#adminStats").hidden = false;
}

function renderBudget(summary) {
  const budget=Number(summary.llm_daily_budget_usd||0), spent=Number(summary.llm_cost_today_usd||0), remaining=Math.max(0,Number(summary.llm_daily_remaining_usd||0));
  const percent=budget>0?Math.min(100,(spent/budget)*100):100;
  $("#budgetRemaining").textContent=dollars(remaining)+" осталось из "+dollars(budget);
  $("#budgetDetails").textContent="Сегодня потрачено: "+dollars(spent)+" · сброс "+formatDate(summary.llm_budget_resets_at,true)+" (UTC)";
  $("#budgetMeter").style.width=percent+"%";
  $("#budgetMeter").style.background=percent>=80?"var(--danger)":percent>=60?"var(--warn)":"var(--ok)";
  $("#budgetPanel").hidden=false;
}

function renderPlans() {
  $("#productMode").textContent = dashboard?.settings?.free_preview_enabled ? "Бесплатный доступ включён; до "+number(dashboard.settings.free_preview_llm_monthly_limit)+" LLM-запросов на пользователя в месяц" : "Тарифные ограничения включены";
  $("#planGrid").innerHTML = (dashboard?.plans || []).map(plan => {
    const price = Number(plan.monthly_price_usd) === 0 ? "Бесплатно" : "$"+Number(plan.monthly_price_usd)+"/мес";
    const annual = Number(plan.annual_price_usd) === 0 ? "Без оплаты" : "$"+Number(plan.annual_price_usd)+" в год ($"+Number(plan.annual_monthly_price_usd)+"/мес)";
    return "<article class='plan-card'><h3>"+esc(plan.name)+"</h3><div class='plan-price'>"+price+"</div><p>"+(plan.platform_limit==null?"Платформы без лимита":"До "+number(plan.platform_limit)+" платформ")+"</p><p>"+(plan.llm_monthly_limit==null?"LLM без лимита":number(plan.llm_monthly_limit)+" LLM-запросов/мес")+"</p><small>"+annual+"</small></article>";
  }).join("");
  $("#plansPanel").hidden = false;
}

function renderUsers() {
  const query = $("#userSearch").value.trim().toLowerCase(), status = $("#statusFilter").value;
  const users = (dashboard?.users || []).filter(user => (!query || user.email.toLowerCase().includes(query)) && (!status || user.status === status));
  $("#usersBody").innerHTML = users.map(user => {
    const activity = user.last_seen_at || user.last_sign_in_at;
    return "<tr><td><b>"+esc(user.email||"Без email")+"</b><small>"+esc(user.plan)+(user.is_admin?" · администратор":"")+"</small></td><td>"+formatDate(user.created_at,false)+"</td><td>"+formatDate(activity,true)+"</td><td><span class='admin-status "+esc(user.status)+"'>"+esc(statusLabel(user.status))+"</span></td><td>"+formatDate(user.trial_ends_at,false)+"</td><td><b>"+number(user.llm_requests_30d)+"</b><small>"+number(user.llm_tokens_30d)+" токенов · "+dollars(user.llm_cost_30d_usd)+"</small></td></tr>";
  }).join("");
  $("#usersEmpty").hidden = users.length > 0;
}

async function loadDashboard() {
  $("#refreshBtn").disabled=true; $("#adminMessage").hidden=false; $("#adminMessage").className="admin-message"; $("#adminMessage").textContent="Загружаю статистику…";
  const {data,error}=await window.supabaseClient.functions.invoke("admin-dashboard",{body:{}}); $("#refreshBtn").disabled=false;
  if(error||!data){let code=error?.message||"dashboard_unavailable";if(error?.context&&typeof error.context.json==="function"){try{code=(await error.context.json())?.error||code}catch(_){}}if(code==="forbidden"){window.location.replace("ai-platforms.html");return}$("#adminMessage").className="admin-message error";$("#adminMessage").textContent="Не удалось загрузить админ-панель: "+code;return}
  dashboard=data; $("#adminMessage").hidden=true; $("#usersPanel").hidden=false; $("#generatedAt").textContent="Обновлено: "+formatDate(data.generated_at,true); renderStats(data.summary); renderBudget(data.summary); renderPlans(); renderUsers();
}

$("#userSearch").addEventListener("input",renderUsers); $("#statusFilter").addEventListener("change",renderUsers); $("#refreshBtn").addEventListener("click",loadDashboard); loadDashboard();
