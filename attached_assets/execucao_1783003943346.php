<?php
require_once 'config.php';
requer_login();
$u = usuario_logado();
// Controle de acesso: módulo 'execucao' ou admin; técnico tem acesso automático
$_perfil_ex  = $u['perfil'] ?? '';
$_is_adm_ex  = ($_perfil_ex === 'admin');
$_is_tec_ex  = ($_perfil_ex === 'tecnico');
$_ac_ex      = (!$_is_adm_ex) ? (json_decode($u['acessos'] ?? '[]', true) ?: []) : [];
if (!$_is_adm_ex && !$_is_tec_ex && !in_array('execucao', $_ac_ex)) {
    header('Location: portal.php'); exit;
}
function _ex_tem($m) { global $_is_adm_ex, $_ac_ex; return $_is_adm_ex || in_array($m, $_ac_ex); }
$paginaAtual = 'execucao';
$logo = 'https://rpshow.com.br/wp-content/uploads/2026/04/logo-rpshow-sem-fundo.png';
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>RPShow — Chamados</title>
<link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&family=DM+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css" rel="stylesheet">
<style>
:root{
  --bg:#060810;--bg2:#0c1020;--bg3:#111827;
  --border:rgba(0,200,255,.1);--border2:rgba(0,200,255,.3);
  --cyan:#00C8FF;--green:#00E676;--red:#FF3D57;
  --gold:#FFB800;--orange:#FF6B35;--purple:#A855F7;
  --text:#FFF;--text2:rgba(255,255,255,.75);--text3:rgba(255,255,255,.35);
  --font-h:'Rajdhani',sans-serif;--font-b:'DM Sans',sans-serif;
  --r:14px;--rs:9px;
}
*{box-sizing:border-box;margin:0;padding:0;}
body{background:var(--bg);color:var(--text);font-family:var(--font-b);min-height:100vh;padding-bottom:20px;}

/* TOPBAR */
.topbar{background:linear-gradient(135deg,#0a1628,#0c1a30);border-bottom:2px solid rgba(0,200,255,.2);padding:0 14px;height:54px;display:flex;align-items:center;gap:10px;position:sticky;top:0;z-index:90;}

/* TOPBAR OPÇÃO A */
.topbar-opcao-a{background:linear-gradient(135deg,#0a1628,#0c1a30);border-bottom:2px solid rgba(0,200,255,.2);padding:0 40px;height:70px;display:flex;align-items:center;gap:20px;position:sticky;top:0;z-index:101;}
.logo-section{display:flex;align-items:center;gap:12px;}
.logo-img{width:50px;height:50px;border-radius:6px;object-fit:contain;background:rgba(0,200,255,.08);padding:4px;}
.logo-text{display:flex;flex-direction:column;gap:2px;line-height:1.2;}
.logo-name{font-family:var(--font-h);font-size:14px;font-weight:700;color:var(--cyan);letter-spacing:1px;}
.logo-desc{font-size:9px;color:var(--text3);}
.logo-cnpj{font-size:8px;color:var(--text3);font-weight:500;}
.menu-opcao-a{display:flex;gap:0;margin-left:auto;margin-right:auto;flex:1;max-width:600px;justify-content:center;}
.menu-opcao-a a{padding:10px 14px;color:var(--text2);text-decoration:none;font-size:11px;font-weight:600;transition:all .2s;border-bottom:2px solid transparent;white-space:nowrap;}
.menu-opcao-a a:hover{color:var(--cyan);border-bottom-color:var(--cyan);}
.menu-opcao-a a.ativo{color:var(--cyan);border-bottom-color:var(--cyan);}
.topbar-btns{display:flex;gap:8px;margin-left:auto;}
.btn-topbar{padding:8px 16px;border:1px solid rgba(0,200,255,.3);background:transparent;color:var(--text);border-radius:6px;font-family:var(--font-h);font-size:11px;font-weight:600;cursor:pointer;transition:all .2s;text-decoration:none;}
.btn-topbar:hover{border-color:var(--cyan);color:var(--cyan);}
.btn-topbar.orange{border-color:var(--orange);color:var(--orange);}
.btn-topbar.orange:hover{background:rgba(255,107,53,.1);}

.back-btn{display:flex;align-items:center;gap:5px;color:var(--cyan);font-size:13px;text-decoration:none;padding:6px 12px;border-radius:var(--rs);border:1px solid rgba(0,200,255,.3);font-weight:600;}
.top-title{font-family:var(--font-h);font-size:19px;font-weight:700;flex:1;color:var(--cyan);letter-spacing:1px;}
.top-user{font-size:12px;color:var(--text3);text-align:right;line-height:1.3;}

/* FILTROS */
.filtros{padding:12px 0;display:flex;gap:8px;}
.filtros-top{display:flex;align-items:center;gap:10px;padding:14px 40px;border-bottom:1px solid rgba(255,255,255,.05);}
.fi-busca-wrap{flex:1;display:flex;align-items:center;gap:8px;background:rgba(255,255,255,.05);border:1.5px solid rgba(255,255,255,.1);border-radius:var(--rs);padding:10px 14px;}
.fi-busca{flex:1;background:transparent;border:none;color:#fff;font-family:var(--font-b);font-size:13px;outline:none;}
.fi-busca::placeholder{color:var(--text3);}
.fi-toggle-btn{display:flex;align-items:center;gap:6px;padding:10px 16px;border-radius:var(--rs);background:rgba(255,255,255,.06);border:1.5px solid rgba(255,255,255,.1);color:var(--text2);font-family:var(--font-b);font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;transition:all .2s;}
.fi-toggle-btn:hover,.fi-toggle-btn.ativo{border-color:var(--cyan);color:var(--cyan);background:rgba(0,200,255,.08);}
.filtros-avancados{padding:16px 40px;border-bottom:1px solid rgba(255,255,255,.06);background:rgba(0,0,0,.2);display:block;}
.filtros-avancados.show{display:block;}

/* RESPONSIVO - MOBILE */
@media(max-width:768px){
  .filtros-avancados{display:none !important;}
  .filtros-avancados.show{display:block !important;}
  .filtros-top{padding:10px 14px;}
  .fa-grid{grid-template-columns:1fr;}
  .topbar-opcao-a{padding:0 14px;height:65px;}
  .menu-opcao-a{max-width:none;gap:4px;}
  .menu-opcao-a a{padding:6px 8px;font-size:9px;}
}
.fa-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;}
.fa-group{display:flex;flex-direction:column;gap:6px;}
.fa-lbl{font-size:10px;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;color:rgba(255,255,255,.4);display:flex;align-items:center;gap:5px;}
.fi{width:100%;background:var(--bg2);border:1px solid var(--border);color:var(--text);border-radius:var(--rs);padding:10px 12px;font-family:var(--font-b);font-size:13px;outline:none;-webkit-appearance:none;}
.fi::placeholder{color:var(--text3);}
.fi:focus{border-color:var(--border2);}
.fi option{background:var(--bg2);}
.cards-wrap{padding:0 40px;}
.sec-lbl{font-family:var(--font-h);font-size:12px;font-weight:700;color:var(--text3);text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;display:flex;align-items:center;gap:8px;}

/* CHAMADO CARD COMPLETO */
.ch-card{background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);margin-bottom:14px;overflow:hidden;transition:border-color .2s;}
.ch-card.prio-Urgente{border-color:rgba(255,61,87,.4);}
.ch-card.prio-Alta{border-color:rgba(255,184,0,.3);}

/* HEADER DO CARD */
.ch-hd{padding:12px 14px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--border);}
.ch-hd.prio-Urgente{background:rgba(255,61,87,.08);}
.ch-hd.prio-Alta{background:rgba(255,184,0,.06);}
.ch-hd.prio-Normal{background:rgba(0,200,255,.04);}
.ch-num{font-family:var(--font-h);font-size:18px;font-weight:700;color:var(--cyan);line-height:1;}
.ch-prio{font-size:10px;font-weight:700;padding:3px 8px;border-radius:4px;text-transform:uppercase;margin-left:4px;}
.ch-prio.U{color:var(--red);background:rgba(255,61,87,.15);border:1px solid rgba(255,61,87,.3);}
.ch-prio.A{color:var(--gold);background:rgba(255,184,0,.12);border:1px solid rgba(255,184,0,.25);}
.ch-prio.N{color:var(--cyan);background:rgba(0,200,255,.08);border:1px solid rgba(0,200,255,.2);}
.ch-status{margin-left:auto;}
.badge{display:inline-flex;align-items:center;padding:4px 10px;border-radius:20px;font-size:11px;font-weight:700;}
.b-ab{color:var(--gold);background:rgba(255,184,0,.12);border:1px solid rgba(255,184,0,.2);}
.b-an{color:#60a5fa;background:rgba(96,165,250,.12);border:1px solid rgba(96,165,250,.2);}
.b-ag{color:var(--orange);background:rgba(255,107,53,.12);border:1px solid rgba(255,107,53,.2);}
.b-co{color:var(--green);background:rgba(0,230,118,.12);border:1px solid rgba(0,230,118,.2);}
.b-ca{color:var(--red);background:rgba(255,61,87,.12);}

/* CORPO DO CARD */
.ch-body{padding:14px;}

/* CLIENTE INFO */
.cli-row{display:flex;align-items:flex-start;gap:8px;margin-bottom:6px;font-size:13px;}
.cli-row i{width:16px;text-align:center;flex-shrink:0;margin-top:2px;}
.cli-nome{font-size:15px;font-weight:700;color:#fff;}
.relato-box{background:var(--bg3);border-left:3px solid var(--gold);border-radius:0 var(--rs) var(--rs) 0;padding:10px 12px;font-size:13px;color:var(--text2);line-height:1.5;margin:10px 0;max-height:80px;overflow:hidden;position:relative;transition:max-height .3s ease;}
.relato-box.expanded{max-height:none;}
.relato-box::after{content:'';position:absolute;bottom:0;left:0;right:0;height:20px;background:linear-gradient(to bottom,transparent,var(--bg3));pointer-events:none;}
.relato-box.expanded::after{display:none;}
.relato-saiba-mais{display:inline-block;color:var(--cyan);cursor:pointer;font-weight:600;font-size:12px;margin-top:4px;text-decoration:none;}
.relato-saiba-mais:hover{text-decoration:underline;}
.obs-box{background:rgba(255,61,87,.06);border:1px solid rgba(255,61,87,.2);border-radius:var(--rs);padding:8px 12px;font-size:12px;color:var(--red);margin-bottom:8px;display:flex;gap:7px;}

/* FOTO DEFEITO */
.foto-def{width:100%;max-height:160px;object-fit:cover;border-radius:var(--rs);margin:8px 0;border:1px solid var(--border);}

/* EQUIPAMENTO */
.eq-item{background:var(--bg3);border:1px solid var(--border);border-radius:var(--rs);padding:11px;margin-bottom:8px;}
.eq-nome{font-family:var(--font-h);font-size:14px;font-weight:700;display:flex;align-items:center;gap:7px;flex-wrap:wrap;}
.eq-dim{color:var(--gold);font-size:12px;}
.chips{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0;}
.chip{border-radius:20px;padding:2px 8px;font-size:10px;font-weight:600;}
.chip.c{background:rgba(0,200,255,.08);border:1px solid rgba(0,200,255,.15);color:rgba(0,200,255,.9);}
.chip.o{background:rgba(255,107,53,.08);border:1px solid rgba(255,107,53,.2);color:var(--orange);}
.chip.g{background:rgba(0,230,118,.08);border:1px solid rgba(0,230,118,.2);color:var(--green);}
.chip.p{background:rgba(168,85,247,.08);border:1px solid rgba(168,85,247,.2);color:var(--purple);}
.eq-links{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;}
.el{font-size:11px;font-weight:700;padding:5px 12px;border-radius:20px;text-decoration:none;display:inline-flex;align-items:center;gap:4px;}
.el.m{background:rgba(96,165,250,.12);color:#60a5fa;border:1px solid rgba(96,165,250,.2);}
.el.w{background:rgba(0,230,118,.1);color:var(--green);border:1px solid rgba(0,230,118,.2);}
.el.a{background:rgba(255,184,0,.1);color:var(--gold);border:1px solid rgba(255,184,0,.2);}
.eq-foto{width:100%;height:auto;display:block;background:rgba(0,0,0,.2);border-radius:7px;margin-top:6px;border:1px solid rgba(0,200,255,.15);cursor:pointer;}
.specs-t{width:100%;border-collapse:collapse;font-size:10px;text-align:center;margin:6px 0;display:block;overflow-x:auto;}
.specs-t th{background:rgba(0,200,255,.12);color:var(--cyan);padding:4px 5px;border:1px solid rgba(0,200,255,.12);font-weight:700;white-space:nowrap;}
.specs-t td{padding:4px 5px;border:1px solid rgba(255,255,255,.05);color:var(--text2);white-space:nowrap;}

/* TECNICO ATUAL */
.tec-atual{background:rgba(0,200,255,.06);border:1px solid rgba(0,200,255,.15);border-radius:var(--rs);padding:10px 12px;display:flex;align-items:center;gap:8px;margin-top:8px;}
.tec-atual i{color:var(--cyan);}

/* BOTÃO ASSUMIR */
.btn-assumir{width:100%;background:linear-gradient(135deg,var(--cyan),#0099cc);color:#000;border:none;border-radius:var(--rs);padding:16px;font-family:var(--font-h);font-size:18px;font-weight:700;letter-spacing:1px;cursor:pointer;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:10px;margin-top:12px;text-transform:uppercase;}
.btn-assumir:active{opacity:.85;}
.btn-assumir.já-meu{background:linear-gradient(135deg,var(--green),#009944);}
.btn-assumir.outro{background:linear-gradient(135deg,var(--orange),#cc4400);}
.btn-excluir-card{width:100%;background:rgba(255,61,87,.08);border:1px solid rgba(255,61,87,.25);color:var(--red);border-radius:var(--rs);padding:10px;font-family:var(--font-h);font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:6px;}
.btn-excluir-card:active{opacity:.8;}
.btn-finalizar-card{width:100%;background:rgba(0,200,255,.12);border:1px solid rgba(0,200,255,.3);color:var(--cyan);border-radius:var(--rs);padding:10px;font-family:var(--font-h);font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;margin-top:6px;}
.btn-finalizar-card:hover{background:rgba(0,200,255,.2);border-color:var(--cyan);}
.btn-finalizar-card:active{opacity:.8;}
/* ===== TELA DE EXECUÇÃO ===== */
/* MOBILE: execução em tela cheia por cima */
.exec-screen{display:none;position:fixed;inset:0;background:var(--bg);z-index:200;overflow-y:auto;padding-bottom:90px;}
.exec-screen.on{display:block;}
/* DESKTOP */
@media(min-width:1024px){
  #fila{max-width:1400px;margin:0 auto;}
  #cards-lista{display:grid;grid-template-columns:1fr 1fr;gap:16px;}
  .exec-screen{position:static;max-width:960px;margin:0 auto;padding:0 24px 24px;}
  .exec-screen.on{display:block;}
  .bot{padding:10px 24px;}
}
@media(min-width:1400px){
  #cards-lista{grid-template-columns:repeat(6,1fr);}
}

/* TELA CHEIA */
#fila{max-width:100% !important;margin:0;padding:0;}
  #fila{max-width:1400px;}
  .filtro-row{max-width:1400px;}
}


.exec-topbar{background:linear-gradient(135deg,#0a1628,#0c1a30);border-bottom:2px solid rgba(0,200,255,.2);padding:0 14px;height:54px;display:flex;align-items:center;gap:10px;position:sticky;top:0;z-index:90;}
.exec-os-num{font-family:var(--font-h);font-size:18px;font-weight:700;color:var(--cyan);flex:1;}
.btn-voltar-exec{display:flex;align-items:center;gap:5px;color:var(--text2);font-size:13px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);padding:6px 12px;border-radius:var(--rs);cursor:pointer;font-family:var(--font-b);}

/* SEÇÕES EXECUÇÃO */
.sc{background:var(--bg2);border:1px solid var(--border);border-radius:var(--r);margin:0 14px 12px;}
.sc-hd{padding:11px 14px;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--border);}
.sc-t{font-family:var(--font-h);font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;}
.sc-bd{padding:14px;}

/* FORM */
.fg{display:flex;flex-direction:column;gap:4px;margin-bottom:10px;}
.lbl{font-size:10px;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;display:flex;align-items:center;gap:5px;}
.lbl.c{color:var(--cyan);}
.lbl.o{color:var(--orange);}
.lbl.g{color:var(--green);}
.lbl.w{color:rgba(255,255,255,.8);}
.lbl.gold{color:var(--gold);}
.lbl.p{color:var(--purple);}
.inp{background:rgba(255,255,255,.05);border:1.5px solid rgba(255,255,255,.1);color:#fff;border-radius:var(--rs);padding:11px 12px;font-family:var(--font-b);font-size:14px;outline:none;width:100%;-webkit-appearance:none;transition:border-color .2s;}
.inp:focus{border-color:var(--cyan);background:rgba(0,200,255,.05);}
.inp::placeholder{color:rgba(255,255,255,.2);}
.inp[readonly]{background:rgba(0,200,255,.08);color:var(--cyan);font-weight:700;border-color:rgba(0,200,255,.15);}
.inp.he{background:rgba(255,61,87,.08)!important;color:var(--red)!important;border-color:rgba(255,61,87,.2)!important;}
.inp option{background:#0f1828;}
.ta{background:rgba(255,255,255,.05);border:1.5px solid rgba(255,255,255,.1);color:#fff;border-radius:var(--rs);padding:11px 12px;font-family:var(--font-b);font-size:14px;outline:none;width:100%;resize:vertical;min-height:80px;}
.ta:focus{border-color:var(--cyan);}
.ta::placeholder{color:rgba(255,255,255,.2);}
.r2{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.r3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;}

/* HORA EXTRA */
.he-alert{background:rgba(255,61,87,.08);border:1px solid rgba(255,61,87,.3);border-radius:var(--rs);padding:11px;color:var(--red);font-size:13px;font-weight:700;text-align:center;margin-top:8px;}

/* EPIs */
.epi-checks{display:flex;flex-wrap:wrap;gap:6px;}
.epi-ck{display:flex;align-items:center;gap:6px;background:rgba(255,255,255,.04);border:1.5px solid rgba(255,255,255,.1);border-radius:var(--rs);padding:8px 13px;cursor:pointer;font-size:13px;font-weight:600;color:var(--text2);transition:all .2s;user-select:none;}
.epi-ck:hover{border-color:rgba(0,200,255,.3);background:rgba(0,200,255,.06);}
.epi-ck input[type=checkbox]{width:15px;height:15px;accent-color:var(--cyan);cursor:pointer;}
.epi-ck.checked{border-color:var(--cyan);background:rgba(0,200,255,.1);color:var(--cyan);}

/* GASTOS */
.g-card{background:var(--bg3);border:1px solid var(--border);border-radius:var(--rs);padding:11px;margin-bottom:8px;}
.g-hd{display:flex;justify-content:space-between;align-items:center;}
.g-tipo{font-size:13px;font-weight:700;}
.g-val{font-family:var(--font-h);font-size:17px;font-weight:700;color:var(--green);}
.g-desc{font-size:11px;color:var(--text3);margin-top:2px;}
.g-foto-img{width:100%;max-height:110px;object-fit:cover;border-radius:6px;margin-top:7px;}
.total-g{background:rgba(0,230,118,.06);border:1px solid rgba(0,230,118,.2);border-radius:var(--rs);padding:11px;text-align:center;font-family:var(--font-h);font-size:20px;font-weight:700;color:var(--green);margin-bottom:8px;}
.gasto-form{background:rgba(0,200,255,.04);border:1px solid rgba(0,200,255,.2);border-radius:var(--r);padding:13px;margin-top:10px;display:none;}
.gasto-form.on{display:block;}

/* FOTOS */
.fotos-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:8px;}
.f-thumb{position:relative;aspect-ratio:1;border-radius:8px;overflow:hidden;border:1px solid var(--border);}
.f-thumb img{width:100%;height:100%;object-fit:cover;}
.f-del{position:absolute;top:3px;right:3px;background:rgba(255,61,87,.9);color:#fff;border:none;border-radius:50%;width:22px;height:22px;font-size:11px;cursor:pointer;font-weight:700;display:flex;align-items:center;justify-content:center;}
.foto-up{border:2px dashed rgba(255,107,53,.3);border-radius:10px;padding:16px;text-align:center;cursor:pointer;}

/* STATUS */


/* TECNICO BOX */
.tec-box{background:rgba(0,200,255,.06);border:1px solid rgba(0,200,255,.2);border-radius:var(--rs);padding:12px;display:flex;align-items:center;gap:10px;margin-top:6px;}
.tec-av{width:40px;height:40px;background:rgba(0,200,255,.15);border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;}

/* BTNS */
.btn-add{background:rgba(255,255,255,.04);border:2px dashed rgba(255,255,255,.15);color:var(--text3);border-radius:var(--rs);padding:13px;width:100%;font-size:13px;font-weight:600;cursor:pointer;}
.btn-del{background:rgba(255,61,87,.1);border:1px solid rgba(255,61,87,.3);color:var(--red);border-radius:6px;width:30px;height:30px;cursor:pointer;font-size:12px;display:flex;align-items:center;justify-content:center;flex-shrink:0;}

/* BOTTOM BAR */
.bot{position:fixed;bottom:0;left:0;right:0;background:var(--bg2);border-top:1px solid var(--border);z-index:300;padding:10px 24px;}
.bot-inner{display:flex;gap:8px;align-items:center;width:100%;}
.btn-sv{flex:2;background:var(--cyan);color:#000;font-weight:700;font-size:15px;padding:14px;border-radius:var(--rs);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;}
.btn-co{flex:2;background:var(--green);color:#000;font-weight:700;font-size:15px;padding:14px;border-radius:var(--rs);border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;}
.btn-vt{flex:1;background:rgba(255,255,255,.06);color:var(--text2);border:1px solid rgba(255,255,255,.12);padding:14px;border-radius:var(--rs);cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center;gap:6px;font-family:var(--font-b);}

/* NOTIF */
.notif{position:fixed;bottom:80px;left:14px;right:14px;background:#0f1e35;border:1px solid rgba(0,200,255,.3);border-radius:var(--r);padding:13px 16px;display:flex;align-items:center;gap:10px;font-size:14px;z-index:999;box-shadow:0 8px 32px rgba(0,0,0,.6);transform:translateY(120px);opacity:0;transition:all .3s;}
.notif.on{transform:translateY(0);opacity:1;}
.notif.ok i{color:var(--green);}
.notif.er i{color:var(--red);}

::-webkit-scrollbar{width:3px;}
::-webkit-scrollbar-thumb{background:rgba(0,200,255,.2);border-radius:3px;}

/* BOTÃO SAIBA MAIS COMPLETO */
.btn-saiba-mais-completo{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:8px;padding:11px;background:rgba(168,85,247,.08);border:1px solid rgba(168,85,247,.3);color:var(--purple);border-radius:var(--rs);font-family:var(--font-h);font-size:14px;font-weight:700;cursor:pointer;text-decoration:none;letter-spacing:.5px;transition:all .2s;}
.btn-saiba-mais-completo:hover{background:rgba(168,85,247,.18);border-color:var(--purple);}

/* ===== SIDEBAR RESPONSIVO ===== */
.sidebar-toggle{position:fixed;top:15px;left:15px;z-index:101;width:40px;height:40px;background:var(--cyan);border:none;border-radius:8px;cursor:pointer;display:none;align-items:center;justify-content:center;color:#000;font-size:20px;transition:all .2s;}
.sidebar-toggle:hover{background:#00e5ff;}
.sidebar{width:250px;background:var(--bg2);border-right:1px solid var(--border);display:flex;flex-direction:column;position:fixed;top:0;left:0;bottom:0;z-index:100;transition:transform .3s;transform:translateX(0);}
.sidebar-logo{padding:16px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:center;gap:12px;min-height:76px;}
.logo-t{font-family:var(--font-h);font-size:22px;font-weight:700;color:var(--cyan);letter-spacing:1px;}
.logo-s{font-size:10px;color:var(--text3);letter-spacing:2px;text-transform:uppercase;margin-top:2px;}
.sidebar-user{padding:12px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;}
.user-avatar{width:34px;height:34px;background:rgba(0,200,255,.15);border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;color:var(--cyan);}
.user-name{font-size:13px;font-weight:600;color:var(--text);}
.user-role{font-size:10px;color:var(--text3);text-transform:uppercase;}
.sidebar-nav{flex:1;padding:12px 0;overflow-y:auto;}
.nav-sec{padding:10px 18px 4px;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--text3);font-weight:600;}
.nav-item{display:flex;align-items:center;gap:10px;padding:10px 18px;color:var(--text2);cursor:pointer;font-size:14px;font-weight:500;border-left:3px solid transparent;transition:all .2s;}
.nav-item:hover{color:var(--text);background:rgba(0,200,255,.05);}
.nav-item.active{color:var(--cyan);background:rgba(0,200,255,.08);border-left-color:var(--cyan);}
.nav-item .ni{width:18px;text-align:center;font-size:14px;}
.nav-badge{margin-left:auto;background:#FF3D57;color:#fff;font-size:10px;font-weight:700;border-radius:10px;padding:2px 7px;}
.sidebar-footer{padding:14px 18px;border-top:1px solid var(--border);font-size:11px;color:var(--text3);text-align:center;}
.sidebar-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:99;}
.sidebar-close{position:absolute;top:15px;right:15px;background:none;border:none;color:var(--text2);font-size:24px;cursor:pointer;display:none;z-index:102;}
.main{margin-left:250px;display:flex;flex-direction:column;transition:margin-left .3s;}

@media(max-width:768px){
  .sidebar{transform:translateX(-100%);width:280px;box-shadow:0 0 30px rgba(0,0,0,.8);}
  .sidebar.open{transform:translateX(0);}
  .sidebar-toggle{display:flex;}
  .sidebar-overlay.show{display:block;}
  .sidebar-close{display:block;}
  .main{margin-left:0;}
  .sidebar-logo{padding-top:50px;}
}
</style>
</head>
<body>

<?php include '_sidebar.php'; ?>

<!-- MAIN CONTENT -->
<div class="main">

<!-- TOPBAR OPÇÃO A -->
<div class="topbar-opcao-a">
  <div class="logo-section">
    <img src="<?= $logo ?>" alt="RPShow" class="logo-img">
    <div class="logo-text">
      <div class="logo-name">RPSHOW LED SERVICE</div>
      <div class="logo-desc">Comércio de Importação</div>
      <div class="logo-cnpj">CNPJ: 43.738.727/0001-83</div>
    </div>
  </div>

  <div class="menu-opcao-a">
    <?php if(_ex_tem('os')): ?>
    <a href="index.php">Home</a>
    <a href="listar_chamados.php">Chamados</a>
    <?php endif; ?>
    <?php if(_ex_tem('clientes')): ?>
    <a href="clientes.php">Clientes</a>
    <?php endif; ?>
    <a href="execucao.php" class="ativo">Execução</a>
    <?php if(_ex_tem('rel_servicos')): ?>
    <a href="relatorios.php">Relatórios</a>
    <?php endif; ?>
    <a href="portal.php">Portal</a>
  </div>

  <div class="topbar-btns">
    <button class="btn-topbar orange"><i class="fas fa-edit"></i> EDITAR</button>
    <button class="btn-topbar" onclick="history.back()"><i class="fas fa-arrow-left"></i> VOLTAR</button>
    <a href="?logout=1" class="btn-topbar"><i class="fas fa-sign-out-alt"></i> SAIR</a>
  </div>
</div>


<!-- FILTROS -->
<div id="fila">

<!-- BARRA BUSCA RÁPIDA -->
<div class="filtros-top">
  <div class="fi-busca-wrap">
    <i class="fas fa-search" style="color:var(--text3);font-size:14px"></i>
    <input class="fi-busca" type="text" id="f-b" placeholder="Buscar OS, cliente ou relato..." oninput="filtrar()">
  </div>
  <button class="fi-toggle-btn" onclick="toggleFiltros()" id="fi-toggle-btn">
    <i class="fas fa-sliders-h"></i> Filtros <span id="fi-count-badge" style="display:none;background:var(--cyan);color:#000;border-radius:20px;padding:1px 7px;font-size:10px;font-weight:700;margin-left:4px"></span>
  </button>
  <button class="fi-toggle-btn" id="btn-ordenacao" onclick="toggleOrdenacao()" style="background:rgba(0,230,118,.08);border-color:rgba(0,230,118,.3);color:var(--green)">
    <i class="fas fa-sort-up"></i> Crescente ⬆️
  </button>
</div>

<!-- FILTROS AVANÇADOS (colapsável) -->
<div class="filtros-avancados" id="filtros-avancados" style="display:block">
  <div class="fa-grid">
    <div class="fa-group">
      <div class="fa-lbl"><i class="fas fa-flag" style="color:var(--cyan)"></i> Status</div>
      <select class="fi" id="f-s" onchange="filtrar()">
        <option value="">Todos os status</option>
        <option selected>Aberto</option>
        <option>Em andamento</option>
        <option>Aguardando Peças</option>
        <option>Aguardando Acesso</option>
        <option>Em análise</option>
        <option>Aguardando Aprovação</option>
        <option>Concluído</option>
        <option>Cancelado</option>
      </select>
    </div>
    <div class="fa-group">
      <div class="fa-lbl"><i class="fas fa-exclamation-triangle" style="color:var(--red)"></i> Prioridade</div>
      <select class="fi" id="f-p" onchange="filtrar()">
        <option value="">Todas</option>
        <option>Urgente</option>
        <option>Alta</option>
        <option>Normal</option>
      </select>
    </div>
    <div class="fa-group">
      <div class="fa-lbl"><i class="fas fa-tools" style="color:var(--orange)"></i> Tipo</div>
      <select class="fi" id="f-t" onchange="filtrar()">
        <option value="">Todos os tipos</option>
        <option>Manutenção</option>
        <option>Instalação Venda</option>
        <option>Instalação Locação</option>
        <option>Visita Técnica</option>
        <option>Montagem</option>
        <option>Desmontagem</option>
        <option>Treinamento</option>
        <option>Orçamento</option>
        <option>Outros</option>
      </select>
    </div>
    <div class="fa-group">
      <div class="fa-lbl"><i class="fas fa-user-cog" style="color:var(--green)"></i> Técnico</div>
      <select class="fi" id="f-tec" onchange="filtrar()">
        <option value="">Todos</option>
      </select>
    </div>
    <div class="fa-group">
      <div class="fa-lbl"><i class="fas fa-calendar-alt" style="color:var(--gold)"></i> Data Início</div>
      <input class="fi" type="date" id="f-d1" onchange="filtrar()" style="color:#fff">
    </div>
    <div class="fa-group">
      <div class="fa-lbl"><i class="fas fa-calendar-check" style="color:var(--gold)"></i> Data Fim</div>
      <input class="fi" type="date" id="f-d2" onchange="filtrar()" style="color:#fff">
    </div>
  </div>
  <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:10px;padding-top:10px;border-top:1px solid rgba(255,255,255,.06)">
    <button onclick="limparFiltros()" style="padding:7px 16px;border-radius:var(--rs);background:rgba(255,255,255,.06);color:var(--text3);border:1px solid rgba(255,255,255,.1);cursor:pointer;font-size:12px;font-family:var(--font-b)">
      <i class="fas fa-times"></i> Limpar filtros
    </button>
  </div>
</div>


<!-- CARDS FILA -->
<div class="cards-wrap">
  <div class="sec-lbl"><i class="fas fa-clipboard-list"></i> Fila de Chamados <span id="fc" style="color:var(--cyan);font-family:var(--font-h);font-size:16px"></span></div>
  <div id="cards-lista"></div>
</div>

</div><!-- /fila -->

<!-- ===== TELA DE EXECUÇÃO ===== -->
<div class="exec-screen" id="exec-screen">
  <div class="exec-topbar">
    <button class="btn-voltar-exec" onclick="voltarFila()"><i class="fas fa-arrow-left"></i> Fila</button>
    <div class="exec-os-num" id="exec-os-num">—</div>
    <span id="exec-status-badge"></span>
  </div>

  <!-- RESUMO DO CHAMADO (só leitura) -->
  <div class="sc" style="margin-top:14px">
    <div class="sc-hd" style="background:rgba(96,165,250,.06)">
      <i class="fas fa-clipboard-list" style="color:#60a5fa"></i>
      <div class="sc-t" style="color:#60a5fa">Resumo do Chamado</div>
    </div>
    <div class="sc-bd" id="exec-resumo"></div>
  </div>

  <!-- EQUIPE -->
  <div class="sc">
    <div class="sc-hd" style="background:rgba(0,200,255,.04)">
      <i class="fas fa-users" style="color:var(--cyan)"></i>
      <div class="sc-t" style="color:var(--cyan)">Equipe & Veículo</div>
    </div>
    <div class="sc-bd">
      <div class="r2">
        <div class="fg">
          <div class="lbl w"><i class="fas fa-user-plus"></i> Auxiliar / Terceiro</div>
          <input class="inp" type="text" id="tec-aux" placeholder="Nome do auxiliar">
        </div>
        <div class="fg">
          <div class="lbl o"><i class="fas fa-car"></i> Veículo</div>
          <select class="inp" id="veiculo">
            <option value="">— Selecione —</option>
            <option>Fiat Toro</option><option>Fiat Strada EKH</option>
            <option>Fiat Strada UGA</option><option>N/A</option><option>Outros</option>
          </select>
        </div>
      </div>
    </div>
  </div>

  <!-- PONTO -->
  <div class="sc">
    <div class="sc-hd" style="background:rgba(255,184,0,.04)">
      <i class="fas fa-clock" style="color:var(--gold)"></i>
      <div class="sc-t" style="color:var(--gold)">Controle de Ponto</div>
    </div>
    <div class="sc-bd">
      <div class="r2">
        <div class="fg">
          <div class="lbl gold"><i class="fas fa-calendar"></i> Data</div>
          <input class="inp" type="date" id="dt-exec" oninput="calcPonto()">
        </div>
        <div class="fg">
          <div class="lbl w"><i class="fas fa-hourglass"></i> Prazo</div>
          <input class="inp" type="text" id="prazo" readonly>
        </div>
      </div>
      <div class="r3">
        <div class="fg"><div class="lbl g"><i class="fas fa-sign-out-alt"></i> Saída</div>
          <input class="inp" type="time" id="h-saida" oninput="calcPonto()"></div>
        <div class="fg"><div class="lbl o"><i class="fas fa-sign-in-alt"></i> Chegada</div>
          <input class="inp" type="time" id="h-cheg" oninput="calcPonto()"></div>
        <div class="fg"><div class="lbl c"><i class="fas fa-stopwatch"></i> Total</div>
          <input class="inp" type="text" id="h-total" readonly></div>
      </div>
      <div id="he-box"></div>
      <div class="r3" style="margin-top:6px">
        <div class="fg"><div class="lbl w"><i class="fas fa-road"></i> KM Saída</div>
          <input class="inp" type="number" id="km-s" step="0.1" oninput="calcKm()"></div>
        <div class="fg"><div class="lbl w"><i class="fas fa-flag-checkered"></i> KM Volta</div>
          <input class="inp" type="number" id="km-r" step="0.1" oninput="calcKm()"></div>
        <div class="fg"><div class="lbl c"><i class="fas fa-tachometer-alt"></i> Total</div>
          <input class="inp" type="text" id="km-t" readonly></div>
      </div>
    </div>
  </div>

  <!-- EPIs -->
  <div class="sc">
    <div class="sc-hd" style="background:rgba(168,85,247,.04)">
      <i class="fas fa-hard-hat" style="color:var(--purple)"></i>
      <div class="sc-t" style="color:var(--purple)">EPIs</div>
    </div>
    <div class="sc-bd">
      <div class="epi-checks">
        <label class="epi-ck"><input type="checkbox" value="Capacete" onchange="togEpiCk(this)"> ⛑️ Capacete</label>
        <label class="epi-ck"><input type="checkbox" value="Luva" onchange="togEpiCk(this)"> 🧤 Luva</label>
        <label class="epi-ck"><input type="checkbox" value="Óculos" onchange="togEpiCk(this)"> 👓 Óculos</label>
        <label class="epi-ck"><input type="checkbox" value="Colete" onchange="togEpiCk(this)"> 🦺 Colete</label>
        <label class="epi-ck"><input type="checkbox" value="Cinto" onchange="togEpiCk(this)"> 🪢 Cinto</label>
        <label class="epi-ck"><input type="checkbox" value="Talabarte" onchange="togEpiCk(this)"> 🔗 Talabarte</label>
        <label class="epi-ck"><input type="checkbox" value="Protetor Auricular" onchange="togEpiCk(this)"> 🎧 Protetor</label>
        <label class="epi-ck"><input type="checkbox" value="N/A" onchange="togEpiCk(this)"> 🚫 N/A</label>
      </div>
    </div>
  </div>

  <!-- SERVIÇO -->
  <div class="sc">
    <div class="sc-hd" style="background:rgba(0,230,118,.04)">
      <i class="fas fa-tools" style="color:var(--green)"></i>
      <div class="sc-t" style="color:var(--green)">Serviço Executado</div>
    </div>
    <div class="sc-bd">
      <div class="fg"><div class="lbl g"><i class="fas fa-comment-alt"></i> O que foi feito</div>
        <textarea class="ta" id="servico" rows="4" placeholder="Descreva o serviço executado..."></textarea>
      </div>
      <div class="fg"><div class="lbl w"><i class="fas fa-sticky-note"></i> Recomendações</div>
        <textarea class="ta" id="obs-tec" rows="2" placeholder="Recomendações para próxima manutenção..."></textarea>
      </div>
    </div>
  </div>

  <!-- ATENDIMENTOS / RETORNOS -->
  <div class="sc" id="sec-atendimentos" style="display:none">
    <div class="sc-hd" style="background:rgba(255,184,0,.05)">
      <i class="fas fa-calendar-plus" style="color:var(--gold)"></i>
      <div class="sc-t" style="color:var(--gold)">Atendimentos / Retornos</div>
    </div>
    <div class="sc-bd">
      <div style="font-size:12px;color:var(--text3);margin-bottom:12px;line-height:1.5">
        <i class="fas fa-info-circle"></i> Se o serviço não foi concluído hoje e precisa de retorno em outro dia (com outro técnico, veículo ou horário), registre cada dia de atendimento aqui.
      </div>

      <div id="atend-lista" style="margin-bottom:14px"></div>

      <button id="btn-add-atend" onclick="toggleAtendForm()" style="width:100%;background:rgba(255,184,0,.12);color:var(--gold);border:1px dashed rgba(255,184,0,.4);padding:12px;border-radius:var(--rs);cursor:pointer;font-family:var(--font-b);font-weight:700;font-size:14px">
        <i class="fas fa-plus-circle"></i> Adicionar Atendimento / Retorno
      </button>

      <div id="atend-form" style="display:none;margin-top:14px;background:rgba(255,255,255,.02);border:1px solid var(--border);border-radius:var(--rs);padding:16px">
        <input type="hidden" id="at-id" value="">
        <div class="fg"><div class="lbl gold"><i class="fas fa-calendar-day"></i> Data do Atendimento</div>
          <input class="inp" type="date" id="at-data"></div>
        <div class="fg"><div class="lbl w"><i class="fas fa-user-gear"></i> Técnico Responsável</div>
          <select class="inp" id="at-tecnico"><option value="">Selecione...</option></select></div>
        <div class="fg"><div class="lbl w"><i class="fas fa-user-plus"></i> Auxiliar</div>
          <input class="inp" type="text" id="at-aux" placeholder="Nome do auxiliar (se houver)"></div>
        <div class="fg"><div class="lbl w"><i class="fas fa-car"></i> Veículo</div>
          <select class="inp" id="at-veiculo"><option value="">Selecione...</option></select></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="fg"><div class="lbl g"><i class="fas fa-clock"></i> Hora Saída</div>
            <input class="inp" type="time" id="at-hsaida" oninput="calcAtend()"></div>
          <div class="fg"><div class="lbl g"><i class="fas fa-clock"></i> Hora Chegada</div>
            <input class="inp" type="time" id="at-hcheg" oninput="calcAtend()"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="fg"><div class="lbl g"><i class="fas fa-hourglass-half"></i> Horas Trab.</div>
            <input class="inp" type="text" id="at-horas" readonly></div>
          <div class="fg"><div class="lbl gold"><i class="fas fa-bolt"></i> Hora Extra</div>
            <input class="inp" type="text" id="at-hextra" readonly></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
          <div class="fg"><div class="lbl g"><i class="fas fa-road"></i> KM Saída</div>
            <input class="inp" type="number" id="at-kms" step="0.1" oninput="calcAtendKm()"></div>
          <div class="fg"><div class="lbl g"><i class="fas fa-road"></i> KM Retorno</div>
            <input class="inp" type="number" id="at-kmr" step="0.1" oninput="calcAtendKm()"></div>
          <div class="fg"><div class="lbl g"><i class="fas fa-route"></i> KM Total</div>
            <input class="inp" type="text" id="at-kmt" readonly></div>
        </div>
        <div class="fg"><div class="lbl w"><i class="fas fa-clipboard-check"></i> Serviço Executado neste dia</div>
          <textarea class="ta" id="at-servico" rows="3" placeholder="O que foi feito neste atendimento..."></textarea></div>
        <div class="fg" style="display:flex;align-items:center;gap:10px;background:rgba(0,230,118,.06);padding:12px;border-radius:8px;border:1px solid rgba(0,230,118,.2)">
          <input type="checkbox" id="at-concluido" style="width:20px;height:20px;cursor:pointer">
          <label for="at-concluido" style="cursor:pointer;font-weight:700;color:var(--green);font-size:14px">✅ O serviço foi CONCLUÍDO neste atendimento (marca a OS como Concluída)</label>
        </div>
        <div style="display:flex;gap:10px;margin-top:14px">
          <button onclick="salvarAtendimento()" style="flex:1;background:var(--gold);color:#000;font-weight:700;padding:12px;border-radius:var(--rs);border:none;cursor:pointer;font-family:var(--font-b)"><i class="fas fa-save"></i> Salvar Atendimento</button>
          <button onclick="toggleAtendForm()" style="background:rgba(255,255,255,.06);color:var(--text2);padding:12px 18px;border-radius:var(--rs);border:none;cursor:pointer;font-family:var(--font-b)">Cancelar</button>
        </div>
      </div>
    </div>
  </div>

  <!-- GASTOS -->
  <div class="sc">
    <div class="sc-hd" style="background:rgba(0,230,118,.04)">
      <i class="fas fa-receipt" style="color:var(--green)"></i>
      <div class="sc-t" style="color:var(--green)">Gastos & Notinhas</div>
    </div>
    <div class="sc-bd">
      <div id="total-g"></div>
      <div id="gastos-lista"></div>
      <div class="gasto-form" id="gasto-form">
        <div style="font-family:var(--font-h);font-size:14px;font-weight:700;color:var(--green);margin-bottom:10px"><i class="fas fa-plus"></i> Novo Gasto</div>
        <div class="fg"><div class="lbl g"><i class="fas fa-tag"></i> Tipo</div>
          <select class="inp" id="g-tipo">
            <option>🍔 Alimentação</option><option>⛽ Combustível</option>
            <option>🔧 Peça</option><option>📦 Produto</option>
            <option>🛠️ Ferramenta</option><option>🚗 Pedágio/Estac.</option>
            <option>🏨 Hospedagem</option>
          </select>
        </div>
        <div class="fg"><div class="lbl w"><i class="fas fa-comment"></i> Descrição</div>
          <input class="inp" type="text" id="g-desc" placeholder="Ex: Almoço 2 pessoas">
        </div>
        <div class="fg"><div class="lbl g"><i class="fas fa-dollar-sign"></i> Valor R$</div>
          <input class="inp" type="number" id="g-val" step="0.01" placeholder="0,00" style="font-size:20px;font-weight:700">
        </div>
        <div class="fg"><div class="lbl gold"><i class="fas fa-camera"></i> Foto da Notinha</div>
          <div class="foto-up" onclick="document.getElementById('inp-gf').click()">
            <i class="fas fa-camera" style="font-size:24px;color:rgba(255,184,0,.4);display:block;margin-bottom:5px"></i>
            <div style="font-size:13px;color:var(--text3)">Foto da notinha</div>
          </div>
          <input type="file" id="inp-gf" accept="image/*" style="display:none" onchange="loadFotoG(this)">
          <div id="gf-prev" style="display:none;margin-top:7px;position:relative">
            <img id="gf-img" style="width:100%;max-height:130px;object-fit:cover;border-radius:8px;border:1px solid var(--border)">
            <button onclick="rmFotoG()" style="position:absolute;top:5px;right:5px;background:var(--red);color:#fff;border:none;border-radius:50%;width:26px;height:26px;font-size:11px;cursor:pointer;font-weight:700">×</button>
          </div>
          <input type="hidden" id="g-foto">
        </div>
        <div style="display:flex;gap:8px">
          <button style="flex:1;background:rgba(255,255,255,.06);color:var(--text2);border:1px solid rgba(255,255,255,.12);padding:12px;border-radius:var(--rs);cursor:pointer;font-family:var(--font-b)" onclick="cancelG()">Cancelar</button>
          <button style="flex:1;background:var(--cyan);color:#000;font-weight:700;padding:12px;border-radius:var(--rs);border:none;cursor:pointer;font-family:var(--font-b)" onclick="salvarG()"><i class="fas fa-save"></i> Salvar</button>
        </div>
      </div>
      <button class="btn-add" id="btn-ag" onclick="abrirG()"><i class="fas fa-plus"></i> Adicionar Gasto / Notinha</button>
    </div>
  </div>

  <!-- FOTOS -->
  <div class="sc">
    <div class="sc-hd" style="background:rgba(255,107,53,.04)">
      <i class="fas fa-camera" style="color:var(--orange)"></i>
      <div class="sc-t" style="color:var(--orange)">Fotos do Serviço <span style="font-size:11px;color:var(--text3)">(mín. 3)</span></div>
    </div>
    <div class="sc-bd">
      <div class="fotos-grid" id="fotos-g"></div>
      <button class="btn-add" onclick="document.getElementById('inp-f').click()"><i class="fas fa-camera"></i> Adicionar Foto</button>
      <input type="file" id="inp-f" accept="image/*" multiple style="display:none" onchange="loadFotos(this)">
      <div id="fotos-count" style="font-size:12px;text-align:center;margin-top:5px"></div>
    </div>
  </div>

  <!-- FINALIZAÇÃO -->
  <div class="sc">
    <div class="sc-hd" style="background:rgba(168,85,247,.04)">
      <i class="fas fa-check-double" style="color:var(--purple)"></i>
      <div class="sc-t" style="color:var(--purple)">Finalização</div>
    </div>
    <div class="sc-bd">
      <div class="fg">
        <div class="lbl p"><i class="fas fa-user-check"></i> Nome de quem acompanhou / autorizou</div>
        <input class="inp" type="text" id="nome-acomp" placeholder="Responsável pelo equipamento no local">
      </div>
      <div class="tec-box">
        <div class="tec-av"><i class="fas fa-user-cog" style="color:var(--cyan);font-size:17px"></i></div>
        <div>
          <div style="font-size:10px;color:var(--cyan);text-transform:uppercase;letter-spacing:1.5px;font-weight:700">Responsável pelo Serviço</div>
          <div style="font-family:var(--font-h);font-size:19px;font-weight:700"><?= htmlspecialchars($u['nome']) ?></div>
          <div style="font-size:11px;color:var(--text3);margin-top:1px"><i class="fas fa-lock" style="font-size:9px"></i> Confirmado pelo login</div>
        </div>
      </div>
    </div>
  </div>

  <!-- COMENTÁRIO -->
  <div class="sc">
    <div class="sc-hd">
      <i class="fas fa-comment-dots" style="color:var(--text3)"></i>
      <div class="sc-t" style="color:var(--text3)">Comentário / Histórico</div>
    </div>
    <div class="sc-bd">
      <textarea class="ta" id="comentario" rows="2" placeholder="Observação adicional para o histórico..."></textarea>
    </div>
  </div>

  <!-- STATUS — ÚLTIMO -->
  <div class="sc">
    <div class="sc-hd" style="background:rgba(0,200,255,.06);border-bottom:2px solid rgba(0,200,255,.15)">
      <i class="fas fa-flag" style="color:var(--cyan)"></i>
      <div class="sc-t" style="color:var(--cyan)">Status Final</div>
    </div>
    <div class="sc-bd">
      <select class="inp" id="status-val" onchange="selStDrop(this.value)" style="font-size:15px;font-weight:700;padding:13px">
        <option value="Aberto">🟡 Aberto</option>
        <option value="Em andamento" selected>🔵 Em Andamento</option>
        <option value="Retorno Agendado">↻ Retorno Agendado (precisa voltar outro dia)</option>
        <option value="Concluído">✅ Concluído</option>
      </select>
      <div class="fg" style="margin-top:10px">
        <div class="lbl w"><i class="fas fa-comment"></i> Obs. do Status</div>
        <textarea class="ta" id="obs-status" rows="2" placeholder="Ex: Aguardando placa controladora..."></textarea>
      </div>
    </div>
  </div>

  <div style="height:10px"></div>

  <!-- BOTTOM BAR EXECUÇÃO -->
  <div class="bot">
    <div class="bot-inner">
      <button class="btn-vt" onclick="voltarFila()" title="Voltar"><i class="fas fa-arrow-left"></i></button>
      <button class="btn-sv" onclick="salvar(false)"><i class="fas fa-save"></i> Salvar</button>
      <button class="btn-co" onclick="salvarFechar()"><i class="fas fa-check-circle"></i> Salvar e Fechar</button>
      <button class="btn-vt" style="color:var(--gold);border-color:rgba(255,184,0,.3)" onclick="if(ch)window.open('imprimir.php?id='+ch.id,'_blank')" title="Imprimir OS"><i class="fas fa-print"></i></button>
    </div>
  </div>
</div><!-- /exec-screen -->

<div class="notif" id="notif"><i class="fas fa-check-circle"></i> <span id="notif-msg"></span></div>

<script>
const API='api.php';
const MEU_ID=<?= $u['id'] ?>;
const MEU_NOME='<?= addslashes($u['nome']) ?>';
const IS_ADMIN=<?= $u['perfil']==='admin'?'true':'false' ?>;

let todos=[], ch=null, gastos=[], fotosL=[], fotosN=[], epis=[], statusAt='Em andamento', fotoGAt=null, ordenacaoAsc=true;

const specsCat={
  "P1.2mm Indoor 640x480":{resGab:"512×384",mod:"160×160",resModulo:"128×128",brilho:"800 nits",ip:"IP43",peso:"7.5kg",consumo:"130/380W",refresh:"7680Hz",material:"Alumínio Fundido",sistema:"NovaStar",scan:"1/43",grayScale:"16bit",contraste:"6000:1",angulo:"160°",vidaUtil:"100.000h"},
  "P1.8mm Indoor 640x480":{resGab:"344×258",mod:"320×160",resModulo:"172×86",brilho:"1000 nits",ip:"IP43",peso:"8kg",consumo:"150/420W",refresh:"7680Hz",material:"Alumínio Fundido",sistema:"NovaStar",scan:"1/32",grayScale:"16bit",contraste:"6000:1",angulo:"160°",vidaUtil:"100.000h"},
  "P2.5mm Indoor 640x480":{resGab:"256×192",mod:"320×160",resModulo:"128×64",brilho:"1000 nits",ip:"IP43",peso:"8.5kg",consumo:"180/480W",refresh:"7680Hz",material:"Alumínio Fundido",sistema:"NovaStar",scan:"1/32",grayScale:"16bit",contraste:"5000:1",angulo:"160°",vidaUtil:"100.000h"},
  "P2.5mm Outdoor 960x960":{resGab:"384×384",mod:"320×160",resModulo:"128×64",brilho:"4500 nits",ip:"IP65",peso:"25kg",consumo:"320/850W",refresh:"7680Hz",material:"Ferro/Alumínio",sistema:"NovaStar",scan:"1/16",grayScale:"16bit",contraste:"5000:1",angulo:"140°",vidaUtil:"100.000h"},
  "P2.97mm Indoor 500x500":{resGab:"168×168",mod:"250×250",resModulo:"84×84",brilho:"1200 nits",ip:"IP43",peso:"8kg",consumo:"210/520W",refresh:"7680Hz",material:"Alumínio Fundido",sistema:"NovaStar",scan:"1/21",grayScale:"16bit",contraste:"5000:1",angulo:"160°",vidaUtil:"100.000h"},
  "P2.97mm Indoor 500x1000":{resGab:"168×336",mod:"250×250",resModulo:"84×84",brilho:"1200 nits",ip:"IP43",peso:"13kg",consumo:"360/850W",refresh:"7680Hz",material:"Alumínio Fundido",sistema:"NovaStar",scan:"1/21",grayScale:"16bit",contraste:"5000:1",angulo:"160°",vidaUtil:"100.000h"},
  "P2.97mm Outdoor 500x1000":{resGab:"168×336",mod:"250×250",resModulo:"84×84",brilho:"5000 nits",ip:"IP65",peso:"13kg",consumo:"360/850W",refresh:"7680Hz",material:"Alumínio Fundido",sistema:"NovaStar",scan:"1/16",grayScale:"16bit",contraste:"5000:1",angulo:"140°",vidaUtil:"100.000h"},
  "P3.91mm Indoor 500x500":{resGab:"128×128",mod:"250×250",resModulo:"64×64",brilho:"1200 nits",ip:"IP43",peso:"8.5kg",consumo:"240/600W",refresh:"7680Hz",material:"Alumínio Fundido",sistema:"NovaStar",scan:"1/16",grayScale:"16bit",contraste:"5000:1",angulo:"160°",vidaUtil:"100.000h"},
  "P3.91mm Indoor 500x1000":{resGab:"128×256",mod:"250×250",resModulo:"64×64",brilho:"1200 nits",ip:"IP43",peso:"14kg",consumo:"380/900W",refresh:"7680Hz",material:"Alumínio Fundido",sistema:"NovaStar",scan:"1/16",grayScale:"16bit",contraste:"5000:1",angulo:"160°",vidaUtil:"100.000h"},
  "P3.91mm Outdoor 500x500":{resGab:"128×128",mod:"250×250",resModulo:"64×64",brilho:"5000 nits",ip:"IP65",peso:"8.5kg",consumo:"240/620W",refresh:"7680Hz",material:"Alumínio Fundido",sistema:"NovaStar",scan:"1/16",grayScale:"16bit",contraste:"5000:1",angulo:"140°",vidaUtil:"100.000h"},
  "P3.91mm Outdoor 500x1000":{resGab:"128×256",mod:"250×250",resModulo:"64×64",brilho:"5000 nits",ip:"IP65",peso:"14kg",consumo:"380/900W",refresh:"7680Hz",material:"Alumínio Fundido",sistema:"NovaStar",scan:"1/16",grayScale:"16bit",contraste:"5000:1",angulo:"140°",vidaUtil:"100.000h"},
  "P4mm Indoor 960x960":{resGab:"240×240",mod:"320×160",resModulo:"80×40",brilho:"1500 nits",ip:"IP43",peso:"24kg",consumo:"300/780W",refresh:"7680Hz",material:"Ferro/Alumínio",sistema:"NovaStar",scan:"1/10",grayScale:"16bit",contraste:"5000:1",angulo:"160°",vidaUtil:"100.000h"},
  "P4mm Outdoor 960x960":{resGab:"240×240",mod:"320×160",resModulo:"80×40",brilho:"5500 nits",ip:"IP65",peso:"26kg",consumo:"350/900W",refresh:"7680Hz",material:"Ferro/Alumínio",sistema:"NovaStar",scan:"1/10",grayScale:"16bit",contraste:"5000:1",angulo:"140°",vidaUtil:"100.000h"},
  "P5mm Indoor 960x960":{resGab:"192×192",mod:"320×160",resModulo:"64×32",brilho:"1800 nits",ip:"IP43",peso:"26kg",consumo:"320/850W",refresh:"7680Hz",material:"Ferro/Alumínio",sistema:"NovaStar",scan:"1/8",grayScale:"16bit",contraste:"5000:1",angulo:"160°",vidaUtil:"100.000h"},
  "P5mm Outdoor 960x960":{resGab:"192×192",mod:"320×160",resModulo:"64×32",brilho:"6000 nits",ip:"IP65",peso:"28kg",consumo:"380/980W",refresh:"7680Hz",material:"Ferro/Alumínio",sistema:"NovaStar",scan:"1/8",grayScale:"16bit",contraste:"5000:1",angulo:"140°",vidaUtil:"100.000h"},
  "P6mm Indoor 960x960":{resGab:"160×160",mod:"320×160",resModulo:"53×27",brilho:"2000 nits",ip:"IP43",peso:"27kg",consumo:"350/900W",refresh:"7680Hz",material:"Ferro/Alumínio",sistema:"NovaStar",scan:"1/6",grayScale:"16bit",contraste:"5000:1",angulo:"160°",vidaUtil:"100.000h"},
  "P6mm Outdoor 960x960":{resGab:"160×160",mod:"320×160",resModulo:"53×27",brilho:"6200 nits",ip:"IP65",peso:"29kg",consumo:"400/1000W",refresh:"7680Hz",material:"Ferro/Alumínio",sistema:"NovaStar",scan:"1/6",grayScale:"16bit",contraste:"5000:1",angulo:"140°",vidaUtil:"100.000h"},
  "P8mm Outdoor 960x960":{resGab:"120×120",mod:"320×160",resModulo:"40×20",brilho:"7000 nits",ip:"IP65",peso:"30kg",consumo:"450/1100W",refresh:"7680Hz",material:"Ferro/Alumínio",sistema:"NovaStar",scan:"1/5",grayScale:"16bit",contraste:"5000:1",angulo:"140°",vidaUtil:"100.000h"},
  "P10mm Indoor 960x960":{resGab:"96×96",mod:"320×160",resModulo:"32×16",brilho:"2000 nits",ip:"IP43",peso:"28kg",consumo:"420/1000W",refresh:"7680Hz",material:"Ferro/Alumínio",sistema:"NovaStar",scan:"1/4",grayScale:"16bit",contraste:"5000:1",angulo:"160°",vidaUtil:"100.000h"},
  "P10mm Outdoor 960x960":{resGab:"96×96",mod:"320×160",resModulo:"32×16",brilho:"7500 nits",ip:"IP65",peso:"32kg",consumo:"480/1200W",refresh:"7680Hz",material:"Ferro/Alumínio",sistema:"NovaStar",scan:"1/4",grayScale:"16bit",contraste:"5000:1",angulo:"140°",vidaUtil:"100.000h"}
};

function notify(msg,type='ok'){
  const n=document.getElementById('notif');n.className='notif '+type;
  n.querySelector('span').textContent=msg;n.classList.add('on');
  setTimeout(()=>n.classList.remove('on'),3500);
}
function fmt(v){return parseFloat(v||0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});}
function fmtDT(d){if(!d)return'—';const dt=new Date(d);return dt.toLocaleDateString('pt-BR')+' '+dt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});}
function comprimir(src,mw,mh,cb){
  const img=new Image();
  img.onload=()=>{
    let w=img.width,h=img.height;
    if(w>h){if(w>mw){h=Math.round(h*mw/w);w=mw;}}else{if(h>mh){w=Math.round(w*mh/h);h=mh;}}
    const cv=document.createElement('canvas');cv.width=w;cv.height=h;
    cv.getContext('2d').drawImage(img,0,0,w,h);cb(cv.toDataURL('image/jpeg',.7));
  };img.src=src;
}

// ===== CARREGAR E RENDERIZAR FILA =====
async function carregarFila(){
  const r=await fetch(API+'?acao=listar_chamados');
  todos=await r.json();

  // Preencher técnicos no filtro
  const sel=document.getElementById('f-tec');
  if(sel && sel.options.length===1){
    const tecs=[...new Set(todos.filter(c=>c.tecnico_id&&c.tecnico_nome).map(c=>JSON.stringify({id:c.tecnico_id,nome:c.tecnico_nome})))].map(s=>JSON.parse(s));
    tecs.forEach(t=>{const o=document.createElement('option');o.value=t.id;o.textContent=t.nome;sel.appendChild(o);});
  }
  filtrar();
}

function filtrar(){
  const b = document.getElementById('f-b').value.toLowerCase();
  const s = document.getElementById('f-s').value;
  const p = document.getElementById('f-p')?.value||'';
  const t = document.getElementById('f-t')?.value||'';
  const tec = document.getElementById('f-tec')?.value||'';
  const d1 = document.getElementById('f-d1')?.value||'';
  const d2 = document.getElementById('f-d2')?.value||'';

  const f = todos.filter(c=>{
    if(b && !(c.numero_os||'').toLowerCase().includes(b) && 
           !(c.cliente_nome||'').toLowerCase().includes(b) &&
           !(c.cliente_apelido||'').toLowerCase().includes(b) &&
           !(c.relato_problema||'').toLowerCase().includes(b)) return false;
    if(s && c.status !== s) return false;
    if(p && c.prioridade !== p) return false;
    if(t && c.tipo_visita !== t) return false;
    if(tec && String(c.tecnico_id) !== tec) return false;
    if(d1){
      const dt = (c.criado_em||'').slice(0,10);
      if(dt < d1) return false;
    }
    if(d2){
      const dt = (c.criado_em||'').slice(0,10);
      if(dt > d2) return false;
    }
    return true;
  });

  // Atualizar badge de filtros ativos
  const ativos = [s,p,t,tec,d1,d2].filter(Boolean).length;
  const badge = document.getElementById('fi-count-badge');
  if(badge){ badge.textContent=ativos; badge.style.display=ativos>0?'inline':'none'; }

  // Ordenar por data_agendada (controlar com variável ordenacaoAsc)
  f.sort((a, b) => {
    const dataA = a.data_agendada || '9999-99-99';
    const dataB = b.data_agendada || '9999-99-99';
    const comp = dataA.localeCompare(dataB);
    return ordenacaoAsc ? comp : -comp;
  });

  // Atualizar botão de ordenação
  atualizarBtnOrdenacao();
  renderCards(f);
}

function toggleOrdenacao(){
  ordenacaoAsc = !ordenacaoAsc;
  filtrar();
}

function atualizarBtnOrdenacao(){
  const btn = document.getElementById('btn-ordenacao');
  if(btn){
    btn.innerHTML = ordenacaoAsc ? 
      '<i class="fas fa-sort-up"></i> Crescente ⬆️' : 
      '<i class="fas fa-sort-down"></i> Decrescente ⬇️';
    btn.title = ordenacaoAsc ? 
      'Clique para decrescente' : 
      'Clique para crescente';
  }
}

function toggleFiltros(){
  const div = document.getElementById('filtros-avancados');
  const btn = document.getElementById('fi-toggle-btn');
  const aberto = div.style.display !== 'none';
  div.style.display = aberto ? 'none' : 'block';
  btn.classList.toggle('ativo', !aberto);
}

function limparFiltros(){
  ['f-s','f-p','f-t','f-tec','f-d1','f-d2'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  document.getElementById('f-b').value='';
  filtrar();
}

function statusBadge(s){
  const m={'Aberto':'b-ab','Em andamento':'b-an','Aguardando Peças':'b-ag','Aguardando Acesso':'b-ag','Em análise':'b-ag','Aguardando Aprovação':'b-ag','Retorno Agendado':'b-ag','Concluído':'b-co','Cancelado':'b-ca'};
  return '<span class="badge '+(m[s]||'b-ab')+'">'+s+'</span>';
}

  function renderCards(lista){
  document.getElementById('fc').textContent=lista.length;
  const div=document.getElementById('cards-lista');
  if(!lista.length){
    div.innerHTML='<div style="text-align:center;padding:50px 20px;color:var(--text3)"><i class="fas fa-check-circle" style="font-size:48px;display:block;margin-bottom:12px;opacity:.2"></i><div style="font-size:16px">Nenhum chamado encontrado</div></div>';
    return;
  }
  div.innerHTML=lista.map(c=>{
    const jaEu = c.tecnico_id==MEU_ID;
    const temTec = c.tecnico_id && c.tecnico_nome;
    // Botão ação
    let btnTxt, btnCls;
    if(jaEu){
      btnTxt='<i class="fas fa-bolt"></i> Continuar minha OS';
      btnCls='btn-assumir já-meu';
    } else if(temTec && !IS_ADMIN){
      btnTxt='<i class="fas fa-eye"></i> Ver detalhes';
      btnCls='btn-assumir outro';
    } else {
      btnTxt='<i class="fas fa-rocket"></i> Assumir e Executar';
      btnCls='btn-assumir';
    }
    return `<div class="ch-card prio-${c.prioridade}">
      <div class="ch-hd prio-${c.prioridade}">
        <div>
          <div class="ch-num">${c.numero_os}<span class="ch-prio ${c.prioridade[0]}">${c.prioridade}</span></div>
          <div style="font-size:12px;color:var(--text3);margin-top:2px">${fmtDT(c.criado_em)}</div>
        </div>
        <div class="ch-status">${statusBadge(c.status)}</div>
      </div>
      <div class="ch-body">
        <div class="cli-row"><i class="fas fa-building" style="color:#60a5fa"></i><span class="cli-nome">${c.cliente_nome||'—'}${c.cliente_apelido?' <span style="font-size:11px;color:var(--text3);font-weight:400">('+c.cliente_apelido+')</span>':''}</span></div>
        <div class="cli-row"><i class="fas fa-tools" style="color:var(--orange)"></i><span style="font-size:13px;font-weight:600;color:var(--orange)">${c.tipo_visita||'—'}</span></div>
        ${c.relato_problema?'<div class="relato-box" id="relato-'+c.id+'">'+c.relato_problema+'<div onclick="expandirRelato('+c.id+')" class="relato-saiba-mais">▼ Saiba mais</div></div>':''}
        ${temTec?'<div class="tec-atual"><i class="fas fa-user-cog"></i><span style="font-size:13px">Técnico: <b>'+c.tecnico_nome+'</b>'+(jaEu?' (você)':'')+'</span></div>':'<div style="font-size:12px;color:var(--text3);margin-top:8px;padding:8px;background:rgba(255,255,255,.03);border-radius:var(--rs);border:1px dashed rgba(255,255,255,.1);text-align:center"><i class="fas fa-user-plus"></i> Sem técnico definido — disponível</div>'}
        <a href="relatorio_chamado.php?id=${c.id}" class="btn-saiba-mais-completo"><i class="fas fa-file-search"></i> Ver Relatório Completo</a>
        <button class="${btnCls}" onclick="abrirExecucao(${c.id})">${btnTxt}</button>
        ${IS_ADMIN ? `<button class="btn-finalizar-card" onclick="event.stopPropagation();finalizarOS(${c.id},'${c.numero_os}')"><i class="fas fa-flag-checkered"></i> Finalizar com Peças</button>` : ''}
        ${IS_ADMIN ? `<button class="btn-excluir-card" onclick="event.stopPropagation();excluirCard(${c.id},'${c.numero_os}')"><i class="fas fa-trash"></i> Excluir OS</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

function expandirRelato(id){
  const el = document.getElementById('relato-' + id);
  if(el){
    el.classList.toggle('expanded');
    const link = el.querySelector('.relato-saiba-mais');
    if(link){
      link.textContent = el.classList.contains('expanded') ? '▲ Ver menos' : '▼ Saiba mais';
    }
  }
}

async function abrirExecucao(id){
  const r=await fetch(API+'?acao=buscar_chamado&id='+id);
  ch=await r.json();
  const c=ch;
  document.getElementById('exec-os-num').textContent=c.numero_os;
  document.getElementById('exec-status-badge').innerHTML=statusBadge(c.status);
  const endCli=[c.logradouro,c.cl_numero,c.bairro,c.cidade,c.estado].filter(Boolean).join(', ');
  let html='<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:12px;padding-bottom:12px;border-bottom:1px solid rgba(0,200,255,.1)">';
  html+='<div style="text-align:center;padding:8px;background:rgba(0,200,255,.04);border-radius:8px"><div style="font-size:10px;color:var(--text3);text-transform:uppercase">Prioridade</div><div style="font-size:13px;font-weight:700;color:var(--cyan)">'+c.prioridade+'</div></div>';
  html+='<div style="text-align:center;padding:8px;background:rgba(0,200,255,.04);border-radius:8px"><div style="font-size:10px;color:var(--text3);text-transform:uppercase">Data Agendada</div><div style="font-size:13px;font-weight:700;color:var(--cyan)">'+(c.data_agendada?c.data_agendada.slice(0,10):'N/A')+'</div></div>';
  html+='<div style="text-align:center;padding:8px;background:rgba(0,200,255,.04);border-radius:8px"><div style="font-size:10px;color:var(--text3);text-transform:uppercase">Status</div><div style="font-size:13px;font-weight:700;color:var(--cyan)">'+c.status+'</div></div>';
  html+='</div>';
  html+='<div class="cli-row"><i class="fas fa-building" style="color:#60a5fa"></i><b style="font-size:15px">'+c.cliente_nome+'</b>'+(c.cliente_apelido?' <span style="font-size:12px;color:var(--text3);font-weight:400">('+c.cliente_apelido+')</span>':'')+'</div>';
  if(c.cnpj_cpf) html+='<div class="cli-row"><i class="fas fa-id-card" style="color:var(--text3)"></i>'+c.cnpj_cpf+'</div>';
  if(endCli) html+='<div class="cli-row"><i class="fas fa-map-marker-alt" style="color:var(--orange)"></i>'+endCli+'</div>';
  if(c.cliente_whats) html+='<div class="cli-row"><i class="fab fa-whatsapp" style="color:var(--green)"></i><a href="tel:'+c.cliente_whats+'" style="color:var(--green);font-weight:600">'+c.cliente_whats+'</a></div>';
  html+='<div class="relato-box"><b style="color:var(--gold)">'+c.tipo_visita+'</b><br>'+c.relato_problema+'</div>';
  if(c.foto_defeito) html+='<img src="'+c.foto_defeito+'" class="foto-def">';
  if(c.obs_interna) html+='<div class="obs-box"><i class="fas fa-lock" style="margin-top:2px"></i><span><b>OBS INTERNA:</b> '+c.obs_interna+'</span></div>';
  (c.equipamentos||[]).forEach((e,ei)=>{
    const s=specsCat[e.modelo]||null;
    const L=parseFloat(e.largura_m)||0, A=parseFloat(e.altura_m)||0;
    // Pixel pitch a partir do modelo (ex.: "P3.91mm Outdoor 500x500")
    let pitch=''; const mp=(e.modelo||'').match(/P([\d.]+)\s*mm/i); if(mp) pitch='P'+mp[1]+'mm';
    // Tamanho do gabinete em metros a partir do modelo (ex.: 500x500 → 0.5×0.5)
    let gabL=0, gabA=0; const mg=(e.modelo||'').match(/(\d{3,4})\s*[x×]\s*(\d{3,4})/i);
    if(mg){ gabL=parseInt(mg[1])/1000; gabA=parseInt(mg[2])/1000; }
    // Área total
    const area=(L&&A)?(L*A):0;
    // Quantidade de gabinetes
    let qtdGab=''; if(area&&gabL&&gabA){ const cols=Math.round(L/gabL), rows=Math.round(A/gabA); if(cols>0&&rows>0) qtdGab=(cols*rows)+' ('+cols+'×'+rows+')'; }
    // Resolução total = gabinetes × resolução do gabinete (resGab do specsCat)
    let resTotal=''; if(s&&s.resGab&&mg){ const rg=s.resGab.match(/(\d+)\s*[×x]\s*(\d+)/); if(rg){ const cols=Math.round(L/gabL), rows=Math.round(A/gabA); if(cols>0&&rows>0){ const px=cols*parseInt(rg[1]), py=rows*parseInt(rg[2]); resTotal=px+'×'+py+' px'; } } }

    const dim=(L&&A)?(L+'m × '+A+'m'):'—';

    // Bloco de uma linha de info
    const row=(ic,lbl,val)=> val? '<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.05);font-size:13px"><span style="color:var(--text3)">'+ic+' '+lbl+'</span><span style="color:var(--text);font-weight:600;text-align:right">'+val+'</span></div>' : '';

    html+='<div class="eq-item" style="margin-top:14px">';
    // IDENTIFICAÇÃO (clicável para recolher/expandir)
    html+='<div onclick="togglePainel('+ei+')" style="background:rgba(0,200,255,.06);padding:10px 12px;border-radius:8px 8px 0 0;border-bottom:2px solid var(--cyan);cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:10px">'
        +'<div style="flex:1"><div style="font-size:11px;color:var(--cyan);text-transform:uppercase;letter-spacing:.5px;font-weight:700;margin-bottom:4px"><i class="fas fa-tv"></i> Identificação do Painel</div>'
        +'<div style="font-size:16px;font-weight:800;color:#fff">'+(e.modelo||'Painel')+'</div>'
        +'<div style="font-size:12px;color:var(--text3)">'+(e.tipo||'Painel LED')+(e.fabricante?' · '+e.fabricante:'')+'</div></div>'
        +'<div style="display:flex;flex-direction:column;align-items:center;gap:2px;color:var(--cyan)"><i class="fas fa-chevron-down" id="painel-arrow-'+ei+'" style="transition:transform .2s;font-size:18px"></i><span style="font-size:9px;color:var(--text3)" id="painel-hint-'+ei+'">ver mais</span></div></div>';

    // DETALHAMENTO (recolhível) — começa oculto
    html+='<div id="painel-body-'+ei+'" style="display:none;padding:10px 12px">';
    // DIMENSÕES & RESOLUÇÃO
    let dimBlock = row('📏','Dimensão',dim) + row('📐','Área Total',area?area.toFixed(2)+' m²':'') + row('📦','Gabinetes',qtdGab) + row('📺','Resolução',resTotal) + row('🔢','Pixel Pitch',pitch) + row('🗂️','Gabinete (LxA)',s?s.resGab:'');
    if(dimBlock) html+='<div style="font-size:10px;color:var(--gold);text-transform:uppercase;letter-spacing:.5px;font-weight:700;margin:6px 0 2px"><i class="fas fa-ruler-combined"></i> Dimensões & Resolução</div>'+dimBlock;

    // ESPECIFICAÇÕES TÉCNICAS
    let espBlock = row('⚙️','Sistema',e.sistema) + row('🎛️','Controladora',e.controladora) + row('📡','Receiver',e.receiver) + row('🏷️','Lote',e.lote);
    if(espBlock) html+='<div style="font-size:10px;color:var(--green);text-transform:uppercase;letter-spacing:.5px;font-weight:700;margin:10px 0 2px"><i class="fas fa-microchip"></i> Especificações Técnicas</div>'+espBlock;

    // Specs técnicas extras (tabela do specsCat) se existir
    if(s) html+='<div style="margin-top:8px"><table class="specs-t"><thead><tr><th>Brilho</th><th>IP</th><th>Peso</th><th>Consumo</th><th>Refresh</th><th>Scan</th></tr></thead><tbody><tr><td>'+s.brilho+'</td><td>'+s.ip+'</td><td>'+s.peso+'</td><td>'+s.consumo+'</td><td>'+s.refresh+'</td><td>'+s.scan+'</td></tr></tbody></table></div>';

    // LOCALIZAÇÃO
    const endereco = e.na_sede=='1' ? '✅ Na sede do cliente' : (e.endereco_completo||'');
    let locBlock = row('📍','Endereço',endereco);
    let locLinks='';
    if(e.link_maps) locLinks+='<a href="'+e.link_maps+'" target="_blank" class="el m"><i class="fab fa-google"></i> Maps</a>';
    if(e.link_waze) locLinks+='<a href="'+e.link_waze+'" target="_blank" class="el w"><i class="fas fa-route"></i> Waze</a>';
    if(e.arquivo_param_b64) locLinks+='<a href="'+e.arquivo_param_b64+'" download="'+(e.arquivo_param_nome||'param')+'" class="el a"><i class="fas fa-file-download"></i> '+(e.arquivo_param_nome||'Parâm.')+'</a>';
    if(locBlock||locLinks){ html+='<div style="font-size:10px;color:var(--orange);text-transform:uppercase;letter-spacing:.5px;font-weight:700;margin:10px 0 2px"><i class="fas fa-map-marked-alt"></i> Localização</div>'+locBlock; if(locLinks) html+='<div class="eq-links" style="margin-top:6px">'+locLinks+'</div>'; }

    // OBSERVAÇÕES
    if(e.observacoes) html+='<div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;font-weight:700;margin:10px 0 2px"><i class="fas fa-sticky-note"></i> Observações</div><div style="font-size:13px;color:var(--text2);background:rgba(255,255,255,.03);padding:8px 10px;border-radius:6px">'+e.observacoes+'</div>';

    // FOTO
    if(e.foto_url) html+='<div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.5px;font-weight:700;margin:10px 0 4px"><i class="fas fa-camera"></i> Foto do Painel</div><img src="'+e.foto_url+'" class="eq-foto" onclick="ampliarFoto(this.src)">';

    html+='</div></div>';
  });
  document.getElementById('exec-resumo').innerHTML=html;

  // Preencher campos
  document.getElementById('dt-exec').value=c.data_execucao||new Date().toISOString().split('T')[0];
  if(c.hora_saida) document.getElementById('h-saida').value=c.hora_saida.slice(0,5);
  if(c.hora_chegada) document.getElementById('h-cheg').value=c.hora_chegada.slice(0,5);
  if(c.horas_trabalhadas) document.getElementById('h-total').value=c.horas_trabalhadas;
  if(c.km_saida) document.getElementById('km-s').value=c.km_saida;
  if(c.km_retorno) document.getElementById('km-r').value=c.km_retorno;
  if(c.km_total) document.getElementById('km-t').value=c.km_total+' km';
  if(c.tecnico_auxiliar) document.getElementById('tec-aux').value=c.tecnico_auxiliar;
  if(c.veiculo) document.getElementById('veiculo').value=c.veiculo;
  if(c.servico_executado) document.getElementById('servico').value=c.servico_executado;
  if(c.obs_execucao) document.getElementById('obs-tec').value=c.obs_execucao;
  if(c.obs_status) document.getElementById('obs-status').value=c.obs_status;
  if(c.nome_acompanhante) document.getElementById('nome-acomp').value=c.nome_acompanhante;

  // EPIs
  epis=(c.epis_usados||'').split(',').filter(Boolean);
  document.querySelectorAll('.epi-ck input[type=checkbox]').forEach(cb=>{
    const checked=epis.includes(cb.value);
    cb.checked=checked;
    if(checked) cb.closest('.epi-ck').classList.add('checked');
    else cb.closest('.epi-ck').classList.remove('checked');
  });

  // Status
  statusAt=c.status||'Em andamento';
  const stSel=document.getElementById('status-val');
  if(stSel) stSel.value=statusAt;

  // Gastos e fotos
  gastos=[...(c.gastos||[])];
  fotosL=[...(c.fotos||[])];
  fotosN=[];
  renderG();renderF();
  calcPonto();

  // Esconder fila, mostrar execução
  document.getElementById('fila').style.display='none';
  document.getElementById('exec-screen').classList.add('on');
  window.scrollTo(0,0);

  // Atendimentos / retornos desta OS
  prepararFormAtend();
  carregarAtendimentos();
  atualizarVisibilidadeAtend();
}

function voltarFila(){
  document.getElementById('fila').style.display='block';
  document.getElementById('exec-screen').classList.remove('on');
  ch=null;gastos=[];fotosL=[];fotosN=[];epis=[];
  // limpar campos
  ['tec-aux','servico','obs-tec','obs-status','nome-acomp','comentario','h-saida','h-cheg','h-total','km-s','km-r','km-t','prazo'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('he-box').innerHTML='';
  document.getElementById('h-total').className='inp';
  document.querySelectorAll('.epi-ck input[type=checkbox]').forEach(cb=>{cb.checked=false;cb.closest('.epi-ck').classList.remove('checked');});
  carregarFila();
}

// PONTO
function calcPonto(){
  const hs=document.getElementById('h-saida').value;
  const hc=document.getElementById('h-cheg').value;
  const de=document.getElementById('dt-exec').value;
  const hb=document.getElementById('he-box');
  hb.innerHTML='';
  if(ch&&de){
    const ab=new Date(ch.criado_em);
    const ex=new Date(de+'T12:00:00');
    const dias=Math.floor((ex-ab)/86400000);
    document.getElementById('prazo').value=(dias>=0?dias:0)+' dia(s)';
  }
  if(!hs||!hc)return;
  let[hS,mS]=hs.split(':').map(Number);
  let[hC,mC]=hc.split(':').map(Number);
  let minS=hS*60+mS,minC=hC*60+mC;
  if(minC<minS)minC+=1440;
  const minT=minC-minS;
  const htEl=document.getElementById('h-total');
  htEl.value=Math.floor(minT/60)+'h '+(minT%60)+'min';
  htEl.className='inp';
  let minHE=0,msgs=[];
  if(de){
    const dow=new Date(de+'T12:00:00').getDay();
    if(dow===0||dow===6){minHE=minT;msgs.push((dow===0?'DOMINGO':'SÁBADO')+' — todo trabalho é hora extra!');}
    else{
      if(minS<480){const he=480-minS;minHE+=he;msgs.push('Saída '+hs+' — '+Math.floor(he/60)+'h '+(he%60)+'min antes das 08:00');}
      const fim=minC>1440?minC-1440:minC;
      if(fim>1080){const he=fim-1080;minHE+=he;msgs.push('Chegada '+hc+' — '+Math.floor(he/60)+'h '+(he%60)+'min após as 18:00');}
    }
  }
  if(minHE>0){
    hb.innerHTML='<div class="he-alert">⚡ HORA EXTRA: '+Math.floor(minHE/60)+'h '+(minHE%60)+'min<br><small style="font-size:11px;font-weight:400">'+msgs.join(' | ')+'</small></div>';
    htEl.classList.add('he');
  }
}
function calcKm(){
  const s=parseFloat(document.getElementById('km-s').value)||0;
  const r=parseFloat(document.getElementById('km-r').value)||0;
  if(r>s)document.getElementById('km-t').value=(r-s).toFixed(1)+' km';
}

// EPIs
function togEpiCk(cb){
  const val=cb.value;
  const idx=epis.indexOf(val);
  if(cb.checked){if(idx<0)epis.push(val);cb.closest('.epi-ck').classList.add('checked');}
  else{if(idx>=0)epis.splice(idx,1);cb.closest('.epi-ck').classList.remove('checked');}
}
function togEpi(btn,epi){ /* legado */ }

// STATUS
let temAtendVisivel=false;
function selStDrop(val){
  statusAt=val;
  atualizarVisibilidadeAtend();
}
function atualizarVisibilidadeAtend(){
  const sec=document.getElementById('sec-atendimentos');
  if(!sec) return;
  const ehRetorno = (statusAt==='Retorno Agendado');
  sec.style.display = (ehRetorno || temAtendVisivel) ? 'block' : 'none';
}
function selSt(el,st,force=false){
  statusAt=st;
  const sel=document.getElementById('status-val');
  if(sel) sel.value=st;
}

// GASTOS
function abrirG(){document.getElementById('gasto-form').classList.add('on');document.getElementById('btn-ag').style.display='none';['g-desc','g-val','g-foto'].forEach(i=>document.getElementById(i).value='');fotoGAt=null;document.getElementById('gf-prev').style.display='none';}
function cancelG(){document.getElementById('gasto-form').classList.remove('on');document.getElementById('btn-ag').style.display='block';}
function loadFotoG(inp){const f=inp.files[0];if(!f)return;const rd=new FileReader();rd.onload=ev=>comprimir(ev.target.result,800,800,c=>{fotoGAt=c;document.getElementById('g-foto').value=c;document.getElementById('gf-img').src=c;document.getElementById('gf-prev').style.display='block';});rd.readAsDataURL(f);}
function rmFotoG(){fotoGAt=null;document.getElementById('g-foto').value='';document.getElementById('gf-prev').style.display='none';document.getElementById('inp-gf').value='';}
function salvarG(){
  const v=parseFloat(document.getElementById('g-val').value);
  if(!v){notify('Informe o valor','er');return;}
  gastos.push({tipo:document.getElementById('g-tipo').value,descricao:document.getElementById('g-desc').value,valor:v,foto:fotoGAt||null});
  cancelG();renderG();
}
function rmG(i){gastos.splice(i,1);renderG();}
function renderG(){
  const tot=gastos.reduce((a,g)=>a+parseFloat(g.valor),0);
  document.getElementById('total-g').innerHTML=tot>0?'<div class="total-g">💰 Total: '+fmt(tot)+'</div>':'';
  document.getElementById('gastos-lista').innerHTML=gastos.map((g,i)=>
    '<div class="g-card"><div class="g-hd"><div><div class="g-tipo">'+g.tipo+'</div><div class="g-desc">'+(g.descricao||'')+'</div></div>'+
    '<div style="display:flex;align-items:center;gap:8px"><div class="g-val">'+fmt(g.valor)+'</div>'+
    '<button class="btn-del" onclick="rmG('+i+')"><i class="fas fa-times"></i></button></div></div>'+
    (g.foto?'<img src="'+g.foto+'" class="g-foto-img">':'')+
    '</div>'
  ).join('');
}

// FOTOS
function loadFotos(inp){for(const f of inp.files){const rd=new FileReader();rd.onload=ev=>comprimir(ev.target.result,1200,1200,c=>{fotosN.push({foto:c,legenda:''});renderF();});rd.readAsDataURL(f);}inp.value='';}
function rmFoto(i){if(i<fotosL.length)fotosL.splice(i,1);else fotosN.splice(i-fotosL.length,1);renderF();}
function renderF(){
  const todas=[...fotosL.map(f=>f.foto),...fotosN.map(f=>f.foto)];
  document.getElementById('fotos-g').innerHTML=todas.map((src,i)=>'<div class="f-thumb"><img src="'+src+'" onclick="window.open(this.src)"><button class="f-del" onclick="rmFoto('+i+')">×</button></div>').join('');
  const c=document.getElementById('fotos-count');
  c.textContent=todas.length+' foto(s) '+(todas.length<3?'— mínimo 3':'✅');
  c.style.color=todas.length<3?'var(--red)':'var(--green)';
}

// FLAG GLOBAL PARA EVITAR DUPLICAÇÃO
let salvando = false;

// SALVAR
async function salvarFechar(){
  await salvar(false);
  setTimeout(()=>voltarFila(), 1200);
}

async function salvar(concluir=false){
  // ✅ PROTEÇÃO CONTRA DOUBLE-CLICK
  if(salvando) {
    notify('Aguarde... salvando','info');
    return;
  }
  
  if(!ch){notify('Nenhum chamado aberto','er');return;}
  
  salvando = true;
  const btns=document.querySelectorAll('.btn-sv,.btn-co');
  btns.forEach(b=>b.disabled=true);
  const payload={
    id:ch.id,tecnico_id:MEU_ID,
    tecnico_auxiliar:document.getElementById('tec-aux').value,
    veiculo:document.getElementById('veiculo').value,
    data_execucao:document.getElementById('dt-exec').value||null,
    hora_saida:document.getElementById('h-saida').value||null,
    hora_chegada:document.getElementById('h-cheg').value||null,
    horas_trabalhadas:document.getElementById('h-total').value,
    hora_extra:document.getElementById('he-box').textContent.trim().slice(0,80),
    km_saida:document.getElementById('km-s').value||null,
    km_retorno:document.getElementById('km-r').value||null,
    km_total:(parseFloat(document.getElementById('km-r').value||0)-parseFloat(document.getElementById('km-s').value||0))||null,
    epis_usados:epis.join(','),
    servico_executado:document.getElementById('servico').value,
    obs_execucao:document.getElementById('obs-tec').value,
    obs_status:document.getElementById('obs-status').value,
    nome_acompanhante:document.getElementById('nome-acomp').value,
    assinatura_tecnico:'RESPONSAVEL:'+MEU_NOME,
    assinatura_cliente:null,
    comentario:document.getElementById('comentario').value,
    status:concluir?'Concluído':document.getElementById('status-val').value||statusAt,
    gastos,fotos_novas:fotosN,concluir
  };
  const r=await fetch(API+'?acao=executar_chamado',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
  const d=await r.json();
  
  // ✅ RESETAR FLAG E RE-HABILITAR
  salvando = false;
  btns.forEach(b=>b.disabled=false);
  
  if(r.ok){
    notify(concluir?'✅ OS Concluída!':'💾 Salvo!');
    if(concluir)setTimeout(()=>voltarFila(),1800);
    else{fotosN=[];ch.status=statusAt;}
 } else notify(d.erro||'Erro','er');
}
function finalizarOS(id, numero) {
    if (confirm('🔒 Finalizar esta OS?\n\nApenas administradores podem adicionar peças e valores.\n\nOS: ' + numero)) {
        window.location.href = 'finalizacao.php?id=' + id;
    }
}
async function excluirCard(id, numero) {
    if (!confirm('Excluir a OS ' + numero + '?\nEsta ação não pode ser desfeita!')) return;
    const senha = prompt('Senha master para excluir:');
    if (!senha) return;
    const r = await fetch(API + '?acao=excluir_chamado&id=' + id + '&senha=' + encodeURIComponent(senha), {method:'DELETE'});
    const d = await r.json();
    if (r.ok) { notify('OS ' + numero + ' excluída!'); carregarFila(); }
    else notify(d.erro || 'Senha incorreta', 'er');
}
carregarFila();

// Inicializar com filtro "Aberto"
setTimeout(()=>{
  document.getElementById('f-s').value = 'Aberto';
  filtrar();
}, 100);

// ===== SIDEBAR RESPONSIVO =====
function toggleSidebar(){
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar?.classList.toggle('open');
  overlay?.classList.toggle('show');
}

function closeSidebar(){
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  sidebar?.classList.remove('open');
  overlay?.classList.remove('show');
}

function nav(url){
  closeSidebar();
  setTimeout(() => window.location.href = url, 150);
}

function logout(){
  if(confirm('Deseja realmente sair?')){
    closeSidebar();
    window.location.href = 'login.php?logout=1';
  }
}

// Fecha sidebar ao clicar em nav-item (mobile)
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    if(window.innerWidth <= 768){
      closeSidebar();
    }
  });
});

// Fecha sidebar ao redimensionar pra desktop
window.addEventListener('resize', () => {
  if(window.innerWidth > 768){
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebar-overlay')?.classList.remove('show');
  }
});
// Recolher/expandir informações do painel
function togglePainel(i){
  const body=document.getElementById('painel-body-'+i);
  const arrow=document.getElementById('painel-arrow-'+i);
  const hint=document.getElementById('painel-hint-'+i);
  if(!body) return;
  const aberto = body.style.display!=='none';
  body.style.display = aberto ? 'none' : 'block';
  if(arrow) arrow.style.transform = aberto ? 'rotate(0deg)' : 'rotate(180deg)';
  if(hint) hint.textContent = aberto ? 'ver mais' : 'ocultar';
}

// Ampliar foto em tela cheia (toque/clique)
function ampliarFoto(src){
  let ov=document.getElementById('foto-overlay');
  if(!ov){
    ov=document.createElement('div');
    ov.id='foto-overlay';
    ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;cursor:zoom-out';
    ov.onclick=()=>ov.style.display='none';
    ov.innerHTML='<img id="foto-overlay-img" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:8px"><div style="position:absolute;top:20px;right:24px;color:#fff;font-size:32px;cursor:pointer">&times;</div>';
    document.body.appendChild(ov);
  }
  document.getElementById('foto-overlay-img').src=src;
  ov.style.display='flex';
}

// ════════════ ATENDIMENTOS / RETORNOS ════════════
function prepararFormAtend(){
  // Popular técnicos (reusa lista de usuários técnicos da fila, se houver)
  const selT = document.getElementById('at-tecnico');
  if(selT && selT.options.length <= 1){
    fetch(API+'?acao=listar_tecnicos').then(r=>r.json()).then(list=>{
      if(Array.isArray(list)){
        selT.innerHTML='<option value="">Selecione...</option>'+list.map(t=>`<option value="${t.id}">${t.nome}</option>`).join('');
      }
    }).catch(()=>{});
  }
  // Popular veículos (mesma lista da execução)
  const selV = document.getElementById('at-veiculo');
  if(selV && selV.options.length <= 1){
    const veics=['Fiat Toro','Fiat Strada EKH','Fiat Strada UGA','N/A','Outros'];
    selV.innerHTML='<option value="">Selecione...</option>'+veics.map(v=>`<option>${v}</option>`).join('');
  }
}

function toggleAtendForm(){
  const f=document.getElementById('atend-form');
  const show = f.style.display==='none';
  f.style.display = show ? 'block' : 'none';
  if(show){
    // limpar form para novo
    document.getElementById('at-id').value='';
    ['at-aux','at-hsaida','at-hcheg','at-horas','at-hextra','at-kms','at-kmr','at-kmt','at-servico'].forEach(id=>{const e=document.getElementById(id);if(e)e.value='';});
    document.getElementById('at-data').value=new Date().toISOString().split('T')[0];
    document.getElementById('at-tecnico').value='';
    document.getElementById('at-veiculo').value='';
    document.getElementById('at-concluido').checked=false;
  }
}

// Calcular horas e hora extra do atendimento (mesma regra: 08:00-18:00, fds tudo extra)
function calcAtend(){
  const hs=document.getElementById('at-hsaida').value;
  const hc=document.getElementById('at-hcheg').value;
  if(!hs||!hc){document.getElementById('at-horas').value='';document.getElementById('at-hextra').value='';return;}
  let [hS,mS]=hs.split(':').map(Number);
  let [hC,mC]=hc.split(':').map(Number);
  let minS=hS*60+mS, minC=hC*60+mC;
  if(minC<minS) minC+=1440;
  let minT=minC-minS;
  document.getElementById('at-horas').value=fmtHHMM(minT);
  // hora extra
  let minHE=0;
  const dataStr=document.getElementById('at-data').value;
  let dow=dataStr?new Date(dataStr+'T12:00:00').getDay():-1;
  if(dow===0||dow===6){ minHE=minT; }
  else {
    if(minS<480) minHE+=(480-minS);
    let fim=minC>1440?minC-1440:minC;
    if(fim>1080) minHE+=(fim-1080);
  }
  document.getElementById('at-hextra').value=minHE>0?fmtHHMM(minHE):'00:00';
}
function fmtHHMM(min){ if(min<=0)return '00:00'; return String(Math.floor(min/60)).padStart(2,'0')+':'+String(min%60).padStart(2,'0'); }

function calcAtendKm(){
  const s=parseFloat(document.getElementById('at-kms').value)||0;
  const r=parseFloat(document.getElementById('at-kmr').value)||0;
  const t=r-s;
  document.getElementById('at-kmt').value=(t>0?t.toFixed(1):'0')+' km';
}

async function carregarAtendimentos(){
  const lista=document.getElementById('atend-lista');
  if(!ch||!ch.id){ lista.innerHTML=''; return; }
  try{
    const r=await fetch(API+'?acao=listar_atendimentos&chamado_id='+ch.id);
    const d=await r.json();
    const ats=d.atendimentos||[];
    temAtendVisivel = ats.length > 0;
    atualizarVisibilidadeAtend();
    if(!ats.length){ lista.innerHTML='<div style="font-size:12px;color:var(--text3);text-align:center;padding:10px">Nenhum atendimento adicional registrado.</div>'; return; }
    lista.innerHTML=ats.map(a=>{
      const dt=a.data_execucao?a.data_execucao.split('-').reverse().join('/'):'—';
      const he=a.hora_extra&&a.hora_extra!=='00:00'?`<span style="color:var(--gold);font-weight:700">⚡ ${a.hora_extra} HE</span>`:'';
      const conc=a.concluido_dia==1?'<span style="color:var(--green);font-weight:700">✅ Concluído</span>':'<span style="color:var(--orange)">↻ Retorno</span>';
      return `<div style="background:rgba(255,255,255,.03);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
          <div style="font-weight:700;color:var(--gold)"><i class="fas fa-calendar-day"></i> ${dt} · ${conc}</div>
          <div style="display:flex;gap:6px">
            <button onclick="editarAtendimento(${a.id})" style="background:rgba(0,200,255,.15);color:var(--cyan);border:none;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px"><i class="fas fa-edit"></i></button>
            <button onclick="excluirAtendimento(${a.id})" style="background:rgba(255,60,60,.15);color:#ff6b6b;border:none;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:12px"><i class="fas fa-trash"></i></button>
          </div>
        </div>
        <div style="font-size:12px;color:var(--text2);line-height:1.6">
          <i class="fas fa-user-gear"></i> ${a.tecnico_nome||'—'} ${a.tecnico_auxiliar?' + '+a.tecnico_auxiliar:''}<br>
          <i class="fas fa-car"></i> ${a.veiculo||'—'} · <i class="fas fa-clock"></i> ${(a.hora_saida||'--').slice(0,5)}→${(a.hora_chegada||'--').slice(0,5)} (${a.horas_trabalhadas||'—'}) ${he}<br>
          <i class="fas fa-route"></i> ${a.km_total||0} km ${a.servico_executado?'<br><i class="fas fa-clipboard-check"></i> '+a.servico_executado:''}
        </div>
      </div>`;
    }).join('');
  }catch(e){ lista.innerHTML='<div style="font-size:12px;color:#ff6b6b">Erro ao carregar atendimentos.</div>'; }
}

window._atendCache=[];
async function editarAtendimento(aid){
  const r=await fetch(API+'?acao=listar_atendimentos&chamado_id='+ch.id);
  const d=await r.json();
  const a=(d.atendimentos||[]).find(x=>x.id==aid);
  if(!a) return;
  document.getElementById('atend-form').style.display='block';
  document.getElementById('at-id').value=a.id;
  document.getElementById('at-data').value=a.data_execucao||'';
  document.getElementById('at-tecnico').value=a.tecnico_id||'';
  document.getElementById('at-aux').value=a.tecnico_auxiliar||'';
  document.getElementById('at-veiculo').value=a.veiculo||'';
  document.getElementById('at-hsaida').value=(a.hora_saida||'').slice(0,5);
  document.getElementById('at-hcheg').value=(a.hora_chegada||'').slice(0,5);
  document.getElementById('at-kms').value=a.km_saida||'';
  document.getElementById('at-kmr').value=a.km_retorno||'';
  document.getElementById('at-servico').value=a.servico_executado||'';
  document.getElementById('at-concluido').checked=a.concluido_dia==1;
  calcAtend(); calcAtendKm();
  document.getElementById('atend-form').scrollIntoView({behavior:'smooth'});
}

async function salvarAtendimento(){
  if(!ch||!ch.id){ notify('Abra uma OS primeiro','error'); return; }
  const kmS=parseFloat(document.getElementById('at-kms').value)||null;
  const kmR=parseFloat(document.getElementById('at-kmr').value)||null;
  const kmT=(kmR&&kmS)?(kmR-kmS):null;
  const payload={
    id: document.getElementById('at-id').value||0,
    chamado_id: ch.id,
    data_execucao: document.getElementById('at-data').value||null,
    tecnico_id: document.getElementById('at-tecnico').value||null,
    tecnico_auxiliar: document.getElementById('at-aux').value||'',
    veiculo: document.getElementById('at-veiculo').value||'',
    hora_saida: document.getElementById('at-hsaida').value||null,
    hora_chegada: document.getElementById('at-hcheg').value||null,
    horas_trabalhadas: document.getElementById('at-horas').value||'',
    hora_extra: document.getElementById('at-hextra').value||'',
    km_saida: kmS, km_retorno: kmR, km_total: kmT,
    servico_executado: document.getElementById('at-servico').value||'',
    concluido_dia: document.getElementById('at-concluido').checked?1:0
  };
  try{
    const r=await fetch(API+'?acao=salvar_atendimento',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const d=await r.json();
    if(r.ok && !d.erro){
      notify(payload.concluido_dia?'Atendimento salvo · OS Concluída!':'Atendimento salvo · OS em Retorno');
      document.getElementById('atend-form').style.display='none';
      carregarAtendimentos();
      // atualizar badge de status
      const novoSt=payload.concluido_dia?'Concluído':'Retorno Agendado';
      const badge=document.getElementById('exec-status-badge');
      if(badge) badge.innerHTML=statusBadge(novoSt);
      const selSt2=document.getElementById('status-val');
      if(selSt2){ selSt2.value=novoSt; statusAt=novoSt; }
    } else {
      notify(d.erro||'Erro ao salvar atendimento','error');
    }
  }catch(e){ notify('Erro de conexão','error'); }
}

async function excluirAtendimento(aid){
  if(!confirm('Excluir este atendimento?')) return;
  try{
    const r=await fetch(API+'?acao=excluir_atendimento&id='+aid,{method:'POST'});
    const d=await r.json();
    if(r.ok && !d.erro){ notify('Atendimento excluído'); carregarAtendimentos(); }
    else notify(d.erro||'Erro','error');
  }catch(e){ notify('Erro de conexão','error'); }
}
</script>

<!-- FECHA DIV.MAIN -->
</div>

</body>
</html>