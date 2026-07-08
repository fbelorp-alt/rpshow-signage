<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>RP Show - Contrato de Compra e Venda</title>
    
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
    <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jquery.mask/1.14.16/jquery.mask.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
    
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { background: #f0f2f5; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 20px; }
        
        .dashboard-contrato { display: flex; gap: 0; max-width: 1900px; margin: 0 auto; align-items: flex-start; }

        /* ── Divisor arrastável ── */
        .drag-divider { flex: 0 0 8px; width: 8px; align-self: stretch; background: rgba(230,126,34,.15); cursor: col-resize; border-radius: 4px; transition: background .2s; }
        .drag-divider:hover { background: rgba(230,126,34,.55); }

        .form-side { flex: 0 0 500px; width: 500px; min-width: 360px; background: white; border-radius: 16px; box-shadow: 0 10px 40px rgba(0,0,0,0.1); position: sticky; top: 20px; max-height: calc(100vh - 40px); overflow-y: auto; overflow-x: hidden; }
        .form-header { background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%); color: white; padding: 18px 22px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; }
        .form-header h3 { font-size: 18px; font-weight: 600; display: flex; align-items: center; gap: 10px; }
        .btn-header { background: #e67e22; color: white; border: none; padding: 8px 15px; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: bold; }
        .btn-header:hover { background: #d35400; }
        .btn-limpar { background: #95a5a6; }

        .form-content { padding: 22px; }
        
        .search-section { background: #f8f9fa; border: 1.5px solid #e0e0e0; border-radius: 12px; padding: 15px; margin-top: 25px; }
        .search-bar-container { display: flex; gap: 10px; align-items: center; margin-bottom: 10px; }
        .search-bar-container input { flex: 1; padding: 10px 12px; border: 1.5px solid #ddd; border-radius: 8px; font-size: 13px; }
        .search-bar-container input:focus { outline: none; border-color: #e67e22; }
        .btn-ver-todos { background: #34495e; color: white; border: none; padding: 10px 14px; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 12px; white-space: nowrap; transition: 0.2s; }
        .btn-ver-todos:hover { background: #2c3e50; }
        
        .lista-contratos { background: white; border: 1px solid #ddd; border-radius: 8px; max-height: 220px; overflow-y: auto; }
        .lista-contratos h5 { padding: 8px 12px; background: #eee; color: #2c3e50; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #ddd; display: flex; justify-content: space-between; align-items: center; }
        .counter-badge { background: #e67e22; color: white; padding: 1px 6px; border-radius: 10px; font-size: 10px; font-weight: bold; }
        
        .contrato-item { padding: 10px 12px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center; cursor: pointer; }
        .contrato-item:hover { background: #fff3e0; }
        .contrato-info { flex: 1; }
        .contrato-info strong { font-size: 12px; color: #2c3e50; }
        .contrato-info small { font-size: 10px; color: #777; display: block; margin-top: 2px; }
        .btn-item { background: none; border: none; cursor: pointer; font-size: 14px; padding: 5px; border-radius: 5px; }
        .btn-carregar-item { color: #3498db; }
        .btn-deletar-item { color: #e74c3c; }

        .form-section { margin-bottom: 22px; border-bottom: 1px solid #e0e0e0; padding-bottom: 15px; }
        .form-section h4 { color: #e67e22; font-size: 15px; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
        .form-row { display: flex; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
        .form-group { flex: 1; min-width: 100px; }
        .form-group label { display: block; font-size: 11px; font-weight: 600; color: #777; margin-bottom: 4px; text-transform: uppercase; }
        .form-group input, .form-side select, .form-side textarea { width: 100%; padding: 9px 12px; border: 1.5px solid #e0e0e0; border-radius: 8px; font-size: 13px; }
        .form-group input:focus, .form-side select:focus { outline: none; border-color: #e67e22; }
        
        .produto-linha { display: flex; gap: 12px; margin-bottom: 12px; align-items: center; background: #f8f9fa; padding: 12px; border-radius: 8px; }
        .produto-linha input:nth-child(1) { flex: 3; padding: 10px 12px; border: 1.5px solid #e0e0e0; border-radius: 8px; font-size: 13px; }
        .produto-linha input:nth-child(2) { flex: 0.5; padding: 10px 12px; border: 1.5px solid #e0e0e0; border-radius: 8px; font-size: 13px; text-align: center; }
        .produto-linha input:nth-child(3) { flex: 1; padding: 10px 12px; border: 1.5px solid #e0e0e0; border-radius: 8px; font-size: 13px; }
        
        .btn-buscar-cnpj { background: #e67e22; color: white; border: none; padding: 9px 16px; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: bold; display: flex; align-items: center; gap: 6px; white-space: nowrap; }
        
        .botoes-principais { display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap; }
        .btn-acao { color: white; border: none; padding: 12px 18px; border-radius: 10px; font-size: 13px; font-weight: bold; cursor: pointer; flex: 1; display: flex; align-items: center; justify-content: center; gap: 8px; min-width: 120px; }
        .btn-salvar { background: linear-gradient(135deg, #27ae60 0%, #229954 100%); }
        .btn-whatsapp { background: linear-gradient(135deg, #25D366 0%, #128C7E 100%); }
        .btn-email { background: linear-gradient(135deg, #7f8c8d 0%, #6c7a7a 100%); }
        
        .preview-side { flex: 1; min-width: 0; background: #e0e0e0; border-radius: 16px; padding: 20px; display: flex; flex-direction: column; gap: 15px; overflow-x: hidden; }

        /* ── Barra de zoom ── */
        .zoom-bar { display:flex; align-items:center; gap:8px; background:#2c3e50; border-radius:10px; padding:7px 14px; margin-bottom:4px; flex-shrink:0; }
        .zoom-bar span { color:#e67e22; font-weight:800; font-size:13px; min-width:42px; text-align:center; }
        .zoom-btn { background:rgba(255,255,255,.1); border:none; color:#fff; width:30px; height:30px; border-radius:6px; cursor:pointer; font-size:14px; display:flex; align-items:center; justify-content:center; transition:.15s; }
        .zoom-btn:hover { background:rgba(230,126,34,.5); }
        .zoom-label-txt { color:#94a3b8; font-size:11px; font-weight:600; margin-right:4px; }
        
        .a4-wrapper { width: 100%; display: flex; justify-content: center; margin-bottom: 40px; flex-shrink: 0; }
        .a4-sheet { background: white; width: 210mm; min-height: 297mm; padding: 15mm; box-shadow: 0 5px 20px rgba(0,0,0,0.2); font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 14px; line-height: 1.7; color: #2c3e50; position: relative; margin: 0 auto; }
        
        .watermark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 70%; opacity: 0.05; pointer-events: none; z-index: 0; }
        .watermark img { width: 100%; }
        
        .contrato-header { text-align: center; margin-bottom: 20px; position: relative; z-index: 2; }
        .logo-container img { max-height: 90px; width: auto; display: block; margin: 0 auto 8px; }
        .contrato-header h2 { font-size: 17px; color: #e67e22; border-bottom: 2px solid #e67e22; display: inline-block; padding-bottom: 5px; margin-top: 8px; }
        
        .numero-contrato-box { background: #f8f9fa; border: 1px solid #e0e0e0; border-radius: 8px; padding: 10px 15px; margin-bottom: 15px; text-align: center; font-size: 14px; font-weight: bold; }
        
        .highlight { background: #f0f0f0 !important; color: #333 !important; font-weight: bold; padding: 2px 5px; border-radius: 4px; }
        .tabela-objeto { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 10px; }
        .tabela-objeto th, .tabela-objeto td { border: 1px solid #dee2e6; padding: 9px; font-size: 13px; }
        .tabela-objeto th { background: #f8f9fa; color: #e67e22; }
        
        .txt-desconto { color: #27ae60 !important; font-weight: bold; }
        .txt-imposto { color: #e74c3c !important; font-weight: bold; }
        
        .valor-extenso-box { background: #fdfaf6; border: 1px solid #f5e6d3; border-radius: 6px; padding: 8px; font-size: 12px; font-style: italic; color: #555; text-align: center; margin: 10px 0; }
        
        .clausula { margin: 12px 0; }
        .clausula-title { font-weight: 700; color: #e67e22; font-size: 14px; margin-bottom: 5px; display: flex; align-items: center; gap: 6px; text-transform: uppercase; }
        .clausula-text { font-size: 13px; text-align: justify; margin-left: 5px; line-height: 1.7; }
        
        .grid-especificacoes { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; background: #f8f9fa; padding: 10px; border-radius: 6px; border-left: 3px solid #e67e22; margin-bottom: 15px; }
        .grid-item { font-size: 11px; }
        .grid-item strong { display: block; color: #2c3e50; font-size: 12px; margin-bottom: 2px; }
        
        .dimensoes-container { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; background: #f0f8ff; padding: 10px; border-radius: 6px; margin-top: 10px; border: 1px solid #e67e22; }
        .dimensoes-item { font-size: 12px; }
        .dimensoes-item strong { color: #e67e22; }

        /* ===== Ajuste: compacta um pouco a página 1 para a Cláusula 2ª (specs) caber sem cortar ===== */
        #pagina1 .clausula { margin: 9px 0; }
        #pagina1 .clausula-title { font-size: 13px; margin-bottom: 4px; }
        #pagina1 .grid-especificacoes { gap: 6px; padding: 8px; margin-bottom: 8px; }
        #pagina1 .grid-item { font-size: 10px; }
        #pagina1 .grid-item strong { font-size: 11px; margin-bottom: 1px; }
        #pagina1 #dimensoes-container { gap: 6px 10px; padding: 8px; margin-top: 8px; }
        #pagina1 .dimensoes-item { font-size: 11px; }
        #pagina1 .footer-view { margin-top: 10px !important; }

        /* ===== Flex layout: páginas 1 e 3 — rodapé sempre ancorado no fundo ===== */
        #pagina1, #pagina3 {
            display: flex !important;
            flex-direction: column !important;
            height: 297mm !important;
            min-height: unset !important;
            box-sizing: border-box !important;
        }
        #pagina1-content, #pagina3-content {
            flex: 1 1 auto;
            overflow: hidden;
            min-height: 0;
        }

        .fotos-projeto-container { display: flex; justify-content: space-between; gap: 10px; margin-top: 15px; }
        .foto-box { flex: 1; aspect-ratio: 4/3; background: #f8f9fa; border: 1px dashed #ccc; border-radius: 8px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .foto-box img { width: 100%; height: 100%; object-fit: cover; display: none; }
        .foto-box span { color: #aaa; font-size: 9px; }

        .assinaturas { display: flex; justify-content: space-between; margin-top: 25px; gap: 20px; }
        .assinatura-box { flex: 1; text-align: center; }
        .assinatura-linha { border-top: 1px solid #333; margin: 8px 0; padding-top: 6px; }
        .testemunhas { display: flex; justify-content: space-between; margin-top: 15px; gap: 20px; }
        
        .data-local-box { margin-top: 20px; text-align: right; font-size: 10px; padding: 6px; background: #f8f9fa; border-radius: 6px; border-right: 3px solid #e67e22; }
        .footer-view { margin-top: 30px; padding-top: 10px; border-top: 2px solid #e67e22; text-align: center; font-size: 11px; color: #333; }
        .footer-view i { color: #e67e22; margin-right: 4px; }
        

        /* === MODAL GERENCIADOR === */
        .modal-overlay { display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); z-index:9999; align-items:center; justify-content:center; }
        .modal-overlay.ativo { display:flex; }
        .modal-box { background:#16213e; border-radius:16px; padding:28px; width:90%; max-width:600px; max-height:90vh; overflow-y:auto; box-shadow:0 20px 60px rgba(0,0,0,0.6); }
        .modal-box h2 { color:#e67e22; font-size:17px; margin-bottom:4px; display:flex; align-items:center; gap:8px; }
        .modal-sub { color:#7f8c8d; font-size:11px; margin-bottom:18px; }
        .modal-info { background:#0f3460; border-radius:8px; padding:12px; margin-bottom:14px; }
        .modal-info-row { display:flex; justify-content:space-between; padding:5px 0; border-bottom:1px solid rgba(255,255,255,0.05); font-size:12px; color:#ccc; }
        .modal-info-row:last-child { border:none; }
        .mbadge { padding:2px 10px; border-radius:20px; font-size:11px; font-weight:bold; }
        .mbadge.v { background:#27ae60; color:white; }
        .mbadge.o { background:#e67e22; color:white; }
        .mbadge.r { background:#e74c3c; color:white; }
        .mbtn { width:100%; padding:11px; border:none; border-radius:8px; font-size:13px; font-weight:bold; cursor:pointer; margin-bottom:8px; display:flex; align-items:center; justify-content:center; gap:8px; }
        .mbtn:hover { opacity:0.85; }
        .mbtn-scan { background:#6c3483; color:white; }
        .mbtn-exp { background:#2c3e50; color:white; }
        .mbtn-imp { background:#27ae60; color:white; }
        .mbtn-del { background:#e74c3c; color:white; }
        .mbtn-close { background:#2c2c2c; color:#aaa; margin-top:8px; }
        .msep { border:none; border-top:1px solid rgba(255,255,255,0.07); margin:14px 0; }
        .maviso { background:#7d3c00; border-radius:8px; padding:10px 14px; color:#f39c12; font-size:11px; margin-bottom:10px; }
        .mlista { background:#0a0a1a; border-radius:8px; padding:8px; max-height:200px; overflow-y:auto; display:none; margin-bottom:10px; }
        .mlista-item { background:#16213e; border-radius:5px; padding:8px 10px; margin-bottom:5px; display:flex; justify-content:space-between; align-items:center; }
        .mlista-item strong { color:#e67e22; font-size:11px; }
        .mlista-item small { color:#7f8c8d; font-size:10px; display:block; }
        .mlog { background:#0a0a1a; color:#2ecc71; font-family:monospace; font-size:10px; padding:10px; border-radius:8px; margin-top:10px; max-height:100px; overflow-y:auto; display:none; }
        .mscan { display:none; background:#0a0a1a; border-radius:8px; padding:10px; margin-bottom:10px; font-size:11px; color:#ccc; max-height:140px; overflow-y:auto; }
        .btn-abrir-gerenciador { background:#6c3483; color:white; border:none; padding:7px 12px; border-radius:7px; font-size:11px; font-weight:bold; cursor:pointer; display:flex; align-items:center; gap:6px; white-space:nowrap; }
        .btn-abrir-gerenciador:hover { background:#7d3c98; }

        @media (max-width: 768px) { 
    .dashboard-contrato { flex-direction: column; } 
    .form-side { position: static; max-height: none; min-width: unset; } 
    .preview-side { min-width: unset; padding: 10px; }
    .grid-especificacoes { grid-template-columns: repeat(2, 1fr); } 
    .a4-sheet { width: 100% !important; min-height: auto; padding: 8mm; font-size: 12px !important; }
    .a4-wrapper { overflow-x: auto; }
    .clausula-text { font-size: 11px !important; }
    .grid-item { font-size: 10px !important; }
    .assinaturas { flex-direction: column; gap: 15px; }
    .testemunhas { flex-direction: column; gap: 15px; }
    .contrato-header h2 { font-size: 14px !important; }
    .pdf-footer { flex-direction: column; align-items: center; }
    .btn-pdf-master { width: 90%; }
}
@media (max-width: 480px) {
    body { padding: 8px; }
    .a4-sheet { padding: 6mm; font-size: 11px !important; }
    .form-content { padding: 12px; }
    .form-row { flex-direction: column; }
    .botoes-principais { flex-direction: column; }
    .btn-acao { min-width: unset; }
}
        

        /* === OCULTAR VALORES (VENDAS) === */
        .valores-ocultos .col-valor { display: none !important; }
        .valores-ocultos .tfoot-valores { display: none !important; }
        .valores-ocultos .valor-extenso-ocultavel { display: none !important; }
        .valores-ocultos .clausula-valores-ocultavel { display: none !important; }
        .valores-ocultos-banner { display: none; background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 8px 12px; text-align: center; font-size: 12px; color: #856404; font-weight: bold; margin: 8px 0; }
        .valores-ocultos .valores-ocultos-banner { display: block !important; }

        /* === NOTA PROMISSÓRIA (VENDAS) === */
        .nota-promissoria-modal { display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:10000; align-items:center; justify-content:center; overflow-y:auto; padding:20px; }
        .nota-promissoria-modal.ativo { display:flex; }
        .np-container { background:white; width:210mm; max-width:100%; border-radius:4px; padding:15mm; position:relative; box-shadow:0 20px 60px rgba(0,0,0,0.5); }
        .np-header { text-align:center; border-bottom:3px double #2c3e50; padding-bottom:12px; margin-bottom:16px; }
        .np-titulo { font-size:18px; font-weight:bold; color:#2c3e50; text-transform:uppercase; letter-spacing:1px; }
        .np-subtitulo { font-size:11px; color:#666; margin-top:4px; }
        .np-numero { background:#f8f9fa; border:1px solid #e67e22; border-radius:6px; padding:6px 14px; display:inline-block; font-size:12px; font-weight:bold; color:#2c3e50; margin:10px 0; }
        .np-valor-destaque { border:2px solid #2c3e50; border-radius:8px; padding:12px; text-align:center; margin:14px 0; background:#f8f9fa; }
        .np-valor-destaque .np-rs { font-size:28px; font-weight:bold; color:#e67e22; }
        .np-valor-destaque .np-extenso { font-size:11px; color:#555; font-style:italic; margin-top:4px; }
        .np-corpo { font-size:11px; text-align:justify; line-height:1.7; color:#222; margin:14px 0; }
        .np-corpo strong { color:#2c3e50; }
        .np-clausulas { font-size:10px; color:#444; margin:10px 0; line-height:1.6; }
        .np-assinaturas { display:flex; justify-content:space-between; margin-top:30px; gap:20px; }
        .np-assinatura-box { flex:1; text-align:center; }
        .np-assinatura-linha { border-top:1px solid #333; margin:8px 0; padding-top:5px; font-size:10px; color:#555; }
        .np-reconhecimento { background:#f8f9fa; border:1px solid #e67e22; border-radius:6px; padding:10px; text-align:center; font-size:9px; color:#555; margin-top:16px; }


        /* === DATEPICKER NATIVO === */
        input[type="date"] { cursor: pointer; }
        input[type="date"]::-webkit-calendar-picker-indicator { cursor: pointer; filter: invert(0.3); }
        .regra-data-hint { font-size: 10px; color: #888; margin-top: 2px; font-style: italic; }

        .btn-pdf-master {
            color: white; border: none; padding: 15px 30px; border-radius: 50px;
            font-family: 'Segoe UI', sans-serif; font-weight: bold; font-size: 14px; 
            text-transform: uppercase; cursor: pointer; box-shadow: 0 5px 20px rgba(0,0,0,0.3);
            display: inline-flex; align-items: center; justify-content: center; gap: 10px; 
            transition: 0.3s; margin: 5px;
        }
        .btn-pdf-master:hover { transform: scale(1.03); box-shadow: 0 8px 25px rgba(0,0,0,0.4); }
        .btn-pdf-master:disabled { background: #95a5a6; color: #fff; cursor: not-allowed; box-shadow: none; transform: none; }
        
        .btn-pdf { background: linear-gradient(135deg, #e67e22 0%, #d35400 100%); }
        .btn-save { background: linear-gradient(135deg, #27ae60 0%, #1e8449 100%); }
        
        .pdf-footer { text-align: center; margin-top: 20px; display: flex; gap: 15px; justify-content: center; flex-wrap: wrap; }
        
        .calculo-box { background: #e8f5e9; padding: 8px; border-radius: 6px; margin-top: 5px; text-align: center; font-weight: bold; color: #2e7d32; font-size: 11px; }
    </style>
</head>
<body>

<!-- ══════════ BARRA DE NAVEGAÇÃO SUPERIOR ══════════ -->
<div style="background:#0D1120;border-bottom:1px solid rgba(230,126,34,.3);padding:10px 18px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;position:sticky;top:0;z-index:9000;box-shadow:0 2px 12px rgba(0,0,0,.3);">
  <a href="https://www.rpshow.com.br" target="_blank" style="display:inline-flex;align-items:center;gap:7px;padding:8px 16px;border-radius:8px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);color:#94A3B8;font-family:sans-serif;font-weight:600;font-size:13px;text-decoration:none;transition:.2s;" onmouseover="this.style.background='rgba(230,126,34,.15)';this.style.color='#E67E22'" onmouseout="this.style.background='rgba(255,255,255,.05)';this.style.color='#94A3B8'"><i class="fas fa-home"></i> Home</a>
  <a href="index.php" style="display:inline-flex;align-items:center;gap:7px;padding:8px 16px;border-radius:8px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);color:#94A3B8;font-family:sans-serif;font-weight:600;font-size:13px;text-decoration:none;transition:.2s;" onmouseover="this.style.background='rgba(230,126,34,.15)';this.style.color='#E67E22'" onmouseout="this.style.background='rgba(255,255,255,.05)';this.style.color='#94A3B8'"><i class="fas fa-chart-line"></i> Dashboard</a>
  <a href="relatorios.php" style="display:inline-flex;align-items:center;gap:7px;padding:8px 16px;border-radius:8px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);color:#94A3B8;font-family:sans-serif;font-weight:600;font-size:13px;text-decoration:none;transition:.2s;" onmouseover="this.style.background='rgba(230,126,34,.15)';this.style.color='#E67E22'" onmouseout="this.style.background='rgba(255,255,255,.05)';this.style.color='#94A3B8'"><i class="fas fa-file-alt"></i> Relatórios</a>
  <a href="proposta_venda.php" style="display:inline-flex;align-items:center;gap:7px;padding:8px 16px;border-radius:8px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);color:#94A3B8;font-family:sans-serif;font-weight:600;font-size:13px;text-decoration:none;transition:.2s;" onmouseover="this.style.background='rgba(230,126,34,.15)';this.style.color='#E67E22'" onmouseout="this.style.background='rgba(255,255,255,.05)';this.style.color='#94A3B8'"><i class="fas fa-cart-shopping"></i> Prop. Venda</a>
  <a href="contrato_venda.php?novo=1" style="display:inline-flex;align-items:center;gap:7px;padding:8px 16px;border-radius:8px;background:linear-gradient(135deg,#E67E22,#C0392B);border:none;color:#fff;font-family:sans-serif;font-weight:700;font-size:13px;text-decoration:none;transition:.2s;margin-left:auto;" onmouseover="this.style.filter='brightness(1.1)'" onmouseout="this.style.filter=''"><i class="fas fa-plus-circle"></i> Novo Contrato</a>
</div>

<div class="dashboard-contrato">
    <div class="form-side">
        <div class="form-header">
            <h3><i class="fas fa-file-signature"></i> Gerador de Contrato</h3>
            <div style="display: flex; gap: 8px;">
                <button type="button" class="btn-header" onclick="abrirImportarProposta()" style="background:linear-gradient(135deg,#16a34a,#0f7a37);color:#fff;border:none;"><i class="fas fa-file-import"></i> Importar Proposta</button>
                <button type="button" class="btn-header btn-limpar" onclick="limparFormulario()"><i class="fas fa-eraser"></i> Novo Contrato</button>
                <button type="button" class="btn-abrir-gerenciador" onclick="abrirGerenciador()"><i class="fas fa-database"></i> Gerenciador</button>
            </div>
        </div>
        
        <div class="form-content">
            <input type="hidden" id="in-contrato-id" value="">
            <input type="hidden" id="in-banco-id" value="">

            <div class="form-section">
                <h4><i class="fas fa-building"></i> Dados do Comprador</h4>
                <div class="form-row">
                    <div class="form-group" style="flex:1"><label>Razão Social / Nome</label>
                      <div style="display:flex;gap:6px;position:relative;">
                        <input type="text" id="in-razao" placeholder="Digite nome do cliente ou empresa..." oninput="atualizarPreview(); buscarClientePorNome(this.value)" autocomplete="off" style="flex:1;">
                        <button type="button" onclick="buscarClientePorNomeBtn()" style="background:#E67E22;color:#fff;border:none;padding:9px 14px;border-radius:8px;cursor:pointer;font-weight:bold;font-size:13px;white-space:nowrap;"><i class="fas fa-search"></i> BUSCAR</button>
                        <div id="sugestoes-razao" style="display:none;position:fixed;background:#1E293B;border:1px solid #E67E22;border-radius:8px;z-index:999999;max-height:220px;overflow-y:auto;box-shadow:0 8px 24px rgba(0,0,0,.6);min-width:300px;"></div>
                      </div>
                    </div>
                    <div class="form-group">
                        <label>CNPJ/CPF</label>
                        <div style="display: flex; gap: 8px;">
                            <input type="text" id="in-cnpj" placeholder="00.000.000/0000-00" style="min-width:200px" style="flex: 1;" oninput="atualizarPreview()">
                            <button type="button" class="btn-buscar-cnpj" onclick="buscarDadosCNPJ()"><i class="fas fa-search"></i> Buscar</button>
                        </div>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Contato</label><input type="text" id="in-contato" placeholder="Responsável" oninput="atualizarPreview()"></div>
                    <div class="form-group"><label>Inscrição Estadual</label><input type="text" id="in-ie" placeholder="Isento" oninput="atualizarPreview()"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Telefone</label><input type="text" id="in-telefone" placeholder="(00) 00000-0000" oninput="atualizarPreview()"></div>
                    <div class="form-group"><label>E-mail</label><input type="email" id="in-email" placeholder="email@cliente.com" oninput="atualizarPreview()"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Endereço</label><input type="text" id="in-endereco" placeholder="Rua, número" oninput="atualizarPreview()"></div>
                    <div class="form-group"><label>Bairro</label><input type="text" id="in-bairro" placeholder="Bairro" oninput="atualizarPreview()"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Cidade</label><input type="text" id="in-cidade" placeholder="Cidade" oninput="atualizarPreview()"></div>
                    <div class="form-group"><label>UF</label><input type="text" id="in-estado" placeholder="SP" oninput="atualizarPreview()"></div>
                    <div class="form-group"><label>CEP</label><input type="text" id="in-cep" placeholder="00000-000" oninput="atualizarPreview()"></div>
                </div>
            </div>

            <div class="form-section">
                <h4><i class="fas fa-user-tie"></i> Representante Legal</h4>
                <div class="form-row">
                    <div class="form-group"><label>Nome Completo</label><input type="text" id="in-rep-nome" placeholder="Quem assina" oninput="atualizarPreview()"></div>
                    <div class="form-group"><label>CPF</label><input type="text" id="in-rep-cpf" placeholder="000.000.000-00" oninput="atualizarPreview()"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>RG</label><input type="text" id="in-rep-rg" placeholder="RG" oninput="atualizarPreview()"></div>
                    <div class="form-group"><label>Cargo</label><input type="text" id="in-rep-cargo" placeholder="Ex: Diretor" oninput="atualizarPreview()"></div>
                </div>
            </div>

            <div class="form-section">
                <h4><i class="fas fa-box"></i> Itens do Objeto</h4>
                <div id="produtos-container">
                    <div class="produto-linha" id="prod-linha-1">
                        <input type="text" id="in-prod-1" placeholder="Item 1 - Descrição" oninput="verificarCascataProdutos(1); calcularTotais()">
                        <input type="number" id="in-qtd-1" placeholder="Qtd" min="1" oninput="calcularTotais()">
                        <input type="text" id="in-vlr-1" placeholder="Valor" oninput="calcularTotais()">
                    </div>
                    <div class="produto-linha" id="prod-linha-2" style="display:none;">
                        <input type="text" id="in-prod-2" placeholder="Item 2 - Descrição" oninput="verificarCascataProdutos(2); calcularTotais()">
                        <input type="number" id="in-qtd-2" placeholder="Qtd" min="1" oninput="calcularTotais()">
                        <input type="text" id="in-vlr-2" placeholder="Valor" oninput="calcularTotais()">
                    </div>
                    <div class="produto-linha" id="prod-linha-3" style="display:none;">
                        <input type="text" id="in-prod-3" placeholder="Item 3 - Descrição" oninput="verificarCascataProdutos(3); calcularTotais()">
                        <input type="number" id="in-qtd-3" placeholder="Qtd" min="1" oninput="calcularTotais()">
                        <input type="text" id="in-vlr-3" placeholder="Valor" oninput="calcularTotais()">
                    </div>
                    <div class="produto-linha" id="prod-linha-4" style="display:none;">
                        <input type="text" id="in-prod-4" placeholder="Item 4 - Descrição" oninput="verificarCascataProdutos(4); calcularTotais()">
                        <input type="number" id="in-qtd-4" placeholder="Qtd" min="1" oninput="calcularTotais()">
                        <input type="text" id="in-vlr-4" placeholder="Valor" oninput="calcularTotais()">
                    </div>
                    <div class="produto-linha" id="prod-linha-5" style="display:none;">
                        <input type="text" id="in-prod-5" placeholder="Item 5 - Descrição" oninput="calcularTotais()">
                        <input type="number" id="in-qtd-5" placeholder="Qtd" min="1" oninput="calcularTotais()">
                        <input type="text" id="in-vlr-5" placeholder="Valor" oninput="calcularTotais()">
                    </div>
                </div>

                <div class="form-row" style="margin-top:12px">
                    <div class="form-group" style="flex: 2;">
                        <label>Modelo do Painel (Ficha Técnica) <button type="button" onclick="abrirCadastroModelo()" style="margin-left:8px;background:#27ae60;color:white;border:none;padding:2px 10px;border-radius:6px;font-size:11px;cursor:pointer;font-weight:bold;">+ Novo Modelo</button></label>
                        <select id="in-modelo-painel" onchange="atualizarEspecificacoes(); verificarOrientacaoVisivel(); calcularDimensoes()">
          <option value="">-- Selecione um modelo --</option>
          <option value="P1.2mm Indoor">P1.2mm Indoor (Pixel 1.2mm - Gabinete 512x384)</option>
          <option value="P1.8mm Indoor">P1.8mm Indoor (Pixel 1.8mm - Gabinete 344x258)</option>
          <option value="P2.5mm Indoor">P2.5mm Indoor (Pixel 2.5mm - Gabinete 640x480)</option>
          <option value="P2.5mm Outdoor">P2.5mm Outdoor (Pixel 2.5mm - Gabinete 960x960)</option>
          <option value="P2.97mm Indoor">P2.97mm Indoor (Pixel 2.97mm - Gabinete 500x500)</option>
          <option value="P2.97mm Indoor 500x1000">P2.97mm Indoor (Pixel 2.97mm - Gabinete 500x1000)</option>
          <option value="P2.97mm Outdoor 500x1000">P2.97mm Outdoor (Pixel 2.97mm - Gabinete 500x1000)</option>
          <option value="P3.91mm Indoor">P3.91mm Indoor (Pixel 3.91mm - Gabinete 500x500)</option>
          <option value="P3.91mm Indoor 500x1000">P3.91mm Indoor (Pixel 3.91mm - Gabinete 500x1000)</option>
          <option value="P3.91mm Outdoor 500x1000">P3.91mm Outdoor (Pixel 3.91mm - Gabinete 500x1000)</option>
          <option value="P4mm Indoor">P4mm Indoor (Pixel 4mm - Gabinete 960x960)</option>
          <option value="P4mm Outdoor">P4mm Outdoor (Pixel 4mm - Gabinete 960x960)</option>
          <option value="P5mm Indoor">P5mm Indoor (Pixel 5mm - Gabinete 960x960)</option>
          <option value="P5mm Outdoor">P5mm Outdoor (Pixel 5mm - Gabinete 960x960)</option>
          <option value="P6mm Indoor">P6mm Indoor (Pixel 6mm - Gabinete 960x960)</option>
          <option value="P6mm Outdoor">P6mm Outdoor (Pixel 6mm - Gabinete 960x960)</option>
          <option value="P8mm Outdoor">P8mm Outdoor (Pixel 8mm - Gabinete 960x960)</option>
          <option value="P10mm Indoor">P10mm Indoor (Pixel 10mm - Gabinete 960x960)</option>
          <option value="P10mm Outdoor">P10mm Outdoor (Pixel 10mm - Gabinete 960x960)</option>
        </select>
                    </div>
                </div>
                
                <div class="form-row" style="margin-top:12px">
                    <div class="form-group"><label>Largura do Painel (em metros)</label>
                        <input type="number" id="in-largura" step="0.01" placeholder="Ex: 4.00" oninput="calcularDimensoes()">
                    </div>
                    <div class="form-group"><label>Altura do Painel (em metros)</label>
                        <input type="number" id="in-altura" step="0.01" placeholder="Ex: 2.00" oninput="calcularDimensoes()">
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group"><label>Lote do Módulo</label><input type="text" id="in-lote-modulo" placeholder="Ex: LOTE 2024-001" oninput="atualizarLote()"></div>
                    <div class="form-group"><label>Modelo do Receiver</label><input type="text" id="in-modelo-receiver" placeholder="Ex: NovaStar MRV328" oninput="atualizarReceiver()"></div>
                </div>
                
                <div class="calculo-box" id="calculo-resultado" style="font-size: 11px;">
                    Selecione um modelo e digite largura/altura para calcular
                </div>

                <!-- Orientacao do Gabinete (so modelos retangulares) -->
                <div id="div-orientacao-gabinete" style="display:none;margin-top:10px;background:#f0f8ff;border:1.5px solid #aed6f1;border-radius:10px;padding:12px;">
                    <div style="font-size:11px;font-weight:700;color:#2471a3;text-transform:uppercase;margin-bottom:8px;">🔁 Orientação do Gabinete (modelo retangular)</div>
                    <div style="display:flex;gap:8px;">
                        <label id="btn-orient-vert" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:9px;border:2px solid #e67e22;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;background:#fff3e0;">
                            <input type="radio" name="orientacao_gab" id="in-orientacao-gabinete" value="vertical" onchange="calcularDimensoes()" style="accent-color:#e67e22;" checked>
                            📳 Vertical (padrão)
                        </label>
                        <label id="btn-orient-horiz" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:9px;border:2px solid #e0e0e0;border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;background:#f8f9fa;">
                            <input type="radio" name="orientacao_gab" id="in-orientacao-gabinete-h" value="horizontal" onchange="calcularDimensoes()" style="accent-color:#e67e22;">
                            📺 Horizontal (girado 90°)
                        </label>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group"><label>Desconto (R$)</label><input type="text" id="in-desc" placeholder="0,00" oninput="calcularTotais()"></div>
                    <div class="form-group"><label>Impostos (%)</label><input type="text" id="in-imposto" placeholder="0,00" oninput="calcularTotais()"></div>
                </div>
            </div>

            <div class="form-section">
                <h4><i class="fas fa-handshake"></i> Condições e Prazos</h4>
                <div class="form-group"><label>Condição de Pagamento</label><input type="text" id="in-cond-pag" placeholder="Ex: 50% no pedido e 50% na montagem" oninput="atualizarPreview()"></div>
                <div class="form-row">
                    <div class="form-group"><label>Prazo Entrega</label><input type="date" id="in-prazo-entrega" oninput="atualizarPreview()"></div>
                    <div class="form-group"><label>Endereço Instalação</label><input type="text" id="in-end-inst" placeholder="Deixar em branco para 'O MESMO'" oninput="atualizarPreview()"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Garantia (Dias)</label><input type="text" id="in-garantia" value="365" oninput="atualizarPreview()"></div>
                    <div class="form-group"><label>Deslocamento (R$)</label><input type="text" id="in-deslocamento" value="600,00" oninput="atualizarPreview()"></div>
                </div>
            </div>
            
            <div class="form-section">
                <h4><i class="fas fa-images"></i> Imagens do Projeto</h4>
                <div class="form-group">
                    <label><i class="fas fa-upload"></i> Até 3 Fotos</label>
                    <input type="file" id="in-fotos-multiplas" accept="image/*" multiple onchange="carregarFotosMultiplas(this)">
                </div>
            </div>

            <div class="form-section">
                <h4><i class="fas fa-clipboard"></i> Considerações Finais</h4>
                <div class="form-group"><textarea id="in-consideracoes" rows="3" placeholder="Ex: Será montado na fachada principal..." oninput="atualizarPreview()"></textarea></div>
            </div>

            <div class="form-section">
                <h4><i class="fas fa-users"></i> Testemunhas</h4>
                <div class="form-row">
                    <div class="form-group"><label>Testemunha 1</label><input type="text" id="in-test1-nome" value="Fernando José da Silva" oninput="atualizarPreview()"></div>
                    <div class="form-group"><label>CPF</label><input type="text" id="in-test1-cpf" value="122.283.868-04" oninput="atualizarPreview()"></div>
                </div>
                <div class="form-row">
                    <div class="form-group"><label>Testemunha 2</label><input type="text" id="in-test2-nome" value="Fabiola Cristina Gabriel da Silva" oninput="atualizarPreview()"></div>
                    <div class="form-group"><label>CPF</label><input type="text" id="in-test2-cpf" value="308.244.962-92" oninput="atualizarPreview()"></div>
                </div>
            </div>

            <div class="botoes-principais">
                <button type="button" class="btn-acao btn-salvar" onclick="salvarContratoLocal()"><i class="fas fa-save"></i> Salvar Contrato</button>
                <button type="button" class="btn-acao" onclick="window.location.href='../rpshow-servicos/portal.php'" style="background:linear-gradient(135deg,#6c5ce7,#a855f7);color:#fff;border:none;"><i class="fas fa-th-large"></i> Portal</button>
                <button type="button" class="btn-acao btn-whatsapp" onclick="enviarWhatsApp()"><i class="fab fa-whatsapp"></i> WhatsApp</button>
                <button type="button" class="btn-acao btn-email" onclick="enviarEmail()"><i class="fas fa-envelope"></i> E-mail</button>
                <button type="button" class="btn-acao btn-pdf-master" onclick="gerarPDFContrato()" style="background:linear-gradient(135deg,#c0392b,#922b21);color:#fff;border:none;"><i class="fas fa-file-pdf"></i> Gerar PDF</button>
            </div>
            <div style="display:flex;gap:10px;margin-bottom:15px;">
                <button type="button" id="btn-toggle-valores" onclick="togglePacote()"
                    style="flex:1;background:linear-gradient(135deg,#e67e22,#d35400);color:white;border:none;padding:11px 16px;border-radius:10px;font-size:13px;font-weight:bold;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px;">
                    <i class="fas fa-eye-slash"></i> <span id="btn-toggle-label">Ocultar Valores Unitários</span>
                </button>
            </div>
            <div id="div-valor-manual" style="display:none;margin-bottom:15px;">
                <label style="font-size:11px;font-weight:600;color:#777;text-transform:uppercase;display:block;margin-bottom:4px;">Valor Total Manual (R$) — sobrescreve o cálculo</label>
                <input type="number" id="in-valor-manual" placeholder="Ex: 80000" oninput="calcularTotais()"
                    style="width:100%;padding:10px 12px;border:2px solid #e67e22;border-radius:8px;font-size:15px;font-weight:bold;color:#e67e22;background:#fff8f3;">
            </div>

            <div class="search-section">
                <div class="search-bar-container">
                    <input type="text" id="campo-busca" placeholder="🔍 Digite para filtrar (Nome, CNPJ, Nº ou Cidade)..." onkeyup="filtrarListaLocal()">
                    <button type="button" class="btn-ver-todos" id="btn-toggle-lista" onclick="toggleVerTodos()">Ver Todos</button>
                </div>
                <div style="display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap;">
                    <button type="button" onclick="exportarBackup()" style="flex:1;background:#2c3e50;color:white;border:none;padding:7px 10px;border-radius:7px;font-size:11px;font-weight:bold;cursor:pointer;display:flex;align-items:center;gap:5px;justify-content:center;">
                        <i class="fas fa-download"></i> Exportar Backup
                    </button>
                    <label style="flex:1;background:#27ae60;color:white;border:none;padding:7px 10px;border-radius:7px;font-size:11px;font-weight:bold;cursor:pointer;display:flex;align-items:center;gap:5px;justify-content:center;margin:0;">
                        <i class="fas fa-upload"></i> Importar Backup
                        <input type="file" id="input-importar" accept=".json" onchange="importarBackup(this)" style="display:none;">
                    </label>
                    <button type="button" onclick="diagnosticarStorage()" style="background:#7f8c8d;color:white;border:none;padding:7px 10px;border-radius:7px;font-size:11px;cursor:pointer;" title="Verificar status do armazenamento">
                        <i class="fas fa-info-circle"></i>
                    </button>
                </div>
                <div class="lista-contratos">
                    <h5>
                        <span><i class="fas fa-history"></i> HISTÓRICO LOCAL</span>
                        <span class="counter-badge" id="lbl-contador-contratos">0</span>
                    </h5>
                    <div id="container-lista-contratos"></div>
                </div>
            </div>
        </div>
    </div>

    <div class="drag-divider" id="drag-divider"></div>

    <div class="preview-side">
        <!-- Barra de zoom -->
        <div class="zoom-bar">
            <span class="zoom-label-txt"><i class="fas fa-search"></i> Zoom</span>
            <button class="zoom-btn" onclick="zoomMenos()" title="Diminuir"><i class="fas fa-search-minus"></i></button>
            <span id="zoom-pct">—</span>
            <button class="zoom-btn" onclick="zoomMais()" title="Aumentar"><i class="fas fa-search-plus"></i></button>
            <button class="zoom-btn" onclick="zoomReset()" title="Ajustar à largura" style="margin-left:4px;"><i class="fas fa-compress-arrows-alt"></i></button>
        </div>

        <div class="a4-wrapper">
            <div id="pagina1" class="a4-sheet">
                <div class="watermark">
                    <img src="../wp-content/uploads/2026/04/logo-rpshow-sem-fundo.png" alt="RP Show" style="max-height:85px;width:auto;display:block;margin:0 auto;" onerror="this.style.opacity='0.3'">
                </div>


                <div class="contrato-header">
                    <div class="logo-container" style="display:inline-block;margin-bottom:8px;">
                        <img src="../wp-content/uploads/2026/04/logo-rpshow-sem-fundo.png" alt="RP Show" style="max-height:85px;width:auto;display:block;margin:0 auto;" onerror="this.style.opacity='0.3'">
                    </div>
                    <h2>CONTRATO PARTICULAR DE COMPRA, VENDA E INSTALAÇÃO DE EQUIPAMENTOS ELETRÔNICOS</h2>
                </div>

                <div class="numero-contrato-box">
                    <i class="fas fa-hashtag"></i> Nº DO CONTRATO: <strong id="numero-contrato">CARREGANDO...</strong>
                    <span id="ref-proposta-box" style="display:none;margin-left:14px;padding-left:14px;border-left:1px solid #ccc;font-size:12px;color:#555;">
                        <i class="fas fa-file-import"></i> Origem: Proposta <strong id="ref-proposta-num" style="color:#E67E22;"></strong>
                    </span>
                </div>
                <input type="hidden" id="in-proposta-origem" value="">

                <div id="pagina1-content">
                    <p style="text-align:justify; font-size: 10px;">Pelo presente instrumento particular de compra, venda e instalação de equipamentos eletrônicos, de um lado a empresa <strong>RPSHOW COMÉRCIO DE IMPORTAÇÃO E EXPORTAÇÃO LTDA.</strong>, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº <strong>43.738.727/0001-83</strong> e IE 797.789.826.111, situada na Rua Marechal Deodoro, 319, bairro Centro, CEP 14010-190, na cidade de Ribeirão Preto, estado de São Paulo, neste ato representada pelo sócio <strong>Fabiano Belo da Silva</strong>, brasileiro, empresário, portador do RG nº 24.158.814-5 SSP/SP, inscrito no CPF sob o nº 074.228.248-16, residente e domiciliado na cidade de Ribeirão Preto/SP, doravante denominada <strong>VENDEDORA</strong>; e, de outro lado, como <strong>COMPRADOR(A)</strong>, a empresa:</p>
                    
                    <div class="clausula">
                        <div class="clausula-title"><i class="fas fa-building"></i> DADOS DO COMPRADOR</div>
                        <div style="background:#f8f9fa;padding:10px;border-radius:6px;display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px">
                            <div><strong>Razão Social:</strong><br><span class="highlight" id="out-razao">_________</span></div>
                            <div><strong>CNPJ/CPF:</strong><br><span class="highlight" id="out-cnpj">_________</span></div>
                            <div><strong>Contato:</strong><br><span class="highlight" id="out-contato">_________</span></div>
                            <div><strong>Inscrição Estadual:</strong><br><span class="highlight" id="out-ie">_________</span></div>
                            <div><strong>Telefone:</strong><br><span class="highlight" id="out-telefone">_________</span></div>
                            <div><strong>E-mail:</strong><br><span class="highlight" id="out-email">_________</span></div>
                            <div><strong>Endereço:</strong><br><span class="highlight" id="out-endereco">_________</span>, <span class="highlight" id="out-bairro">_________</span></div>
                            <div><strong>Cidade/Estado:</strong><br><span class="highlight" id="out-cidade">_________</span>/<span class="highlight" id="out-estado">__</span> - CEP: <span class="highlight" id="out-cep">_________</span></div>
                        </div>
                    </div>

                    <div class="clausula">
                        <div class="clausula-title"><i class="fas fa-user-check"></i> REPRESENTANTE LEGAL</div>
                        <div class="clausula-text">Nome: <span class="highlight" id="out-rep-nome">_________</span> | CPF: <span class="highlight" id="out-rep-cpf">_________</span> | RG: <span class="highlight" id="out-rep-rg">_________</span> | Cargo: <span class="highlight" id="out-rep-cargo">_________</span></div>
                    </div>

                    
                    <div class="clausula">
                        <div class="clausula-title"><i class="fas fa-shopping-cart"></i> CLÁUSULA 1ª - DO OBJETO</div>
                        <table class="tabela-objeto">
                            <thead id="thead-produtos"></thead>
                            <tbody id="view_produtos_rows"></tbody>
                            <tfoot id="tfoot-produtos"></tfoot>
                        </table>
                        <div class="valores-ocultos-banner"><i class="fas fa-eye-slash"></i> Valores ocultados — versão para apresentação ao cliente</div>
                        <div class="valor-extenso-box valor-extenso-ocultavel"><i class="fas fa-pen-nib"></i> Valor por extenso: <strong><span id="out-valor-extenso">Zero reais</span></strong>.</div>
                    </div>

                    
                    
                </div><!-- /pagina1-content -->
                <div class="footer-view" style="padding:12px 0;border-top:2px solid #e67e22;text-align:center;">
                    <img src="../wp-content/uploads/2026/04/logo-rpshow-sem-fundo.png" alt="RP Show" style="height:28px;width:auto;opacity:.7;vertical-align:middle;margin-right:8px;" onerror="this.style.display='none'">
                    <strong style="color:#e67e22;letter-spacing:1px;">RPSHOW LED SERVICE</strong> · Tecnologia Visual de Alta Performance<br>
                    <i class="fas fa-building"></i> RPSHOW COMÉRCIO DE IMPORTAÇÃO E EXPORTAÇÃO LTDA | CNPJ: 43.738.727/0001-83<br>
                    <i class="fas fa-phone"></i> (16) 98220-8695 | <i class="fas fa-envelope"></i> contato@rpshow.com.br | www.rpshow.com.br
                </div>
            </div>
        </div>


        <!-- PÁGINA 2 DO CONTRATO -->
        <div class="a4-wrapper">
            <div id="pagina2" class="a4-sheet">
                <div class="watermark">
                    <img src="../wp-content/uploads/2026/04/logo-rpshow-sem-fundo.png" alt="RP Show" style="max-height:85px;width:auto;display:block;margin:0 auto;" onerror="this.style.opacity='0.3'">
                </div>
                <div>

                <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;border-bottom:2px solid #e67e22;margin-bottom:14px;">
                    <img src="../wp-content/uploads/2026/04/logo-rpshow-sem-fundo.png" alt="RP Show" style="max-height:85px;width:auto;display:block;margin:0 auto;" onerror="this.style.opacity='0.3'">
                    <div style="text-align:right;font-size:10px;color:#7f8c8d;font-weight:bold;">CONTRATO PARTICULAR DE COMPRA,<br>VENDA E INSTALAÇÃO DE EQUIPAMENTOS ELETRÔNICOS</div>
                </div>
                    
                    <div class="clausula" id="box-especificacoes">
                        <div class="clausula-title"><i class="fas fa-list-alt"></i> CLÁUSULA 2ª - ESPECIFICAÇÕES TÉCNICAS</div>
                        <div class="grid-especificacoes" id="grid-especificacoes-content"></div>
                        
                        <div id="dimensoes-container" class="dimensoes-container" style="grid-template-columns:repeat(3,1fr);">
                            <div class="dimensoes-item"><strong>📏 Dimensão:</strong> <span id="out-dim-painel">_________</span></div>
                            <div class="dimensoes-item"><strong>📐 Área Total:</strong> <span id="out-area">_________</span> m²</div>
                            <div class="dimensoes-item"><strong>📦 Gabinetes:</strong> <span id="out-gabinetes">_________</span></div>
                            <div class="dimensoes-item"><strong>📺 Resolução:</strong> <span id="out-resolucao">_________</span></div>
                            <div class="dimensoes-item"><strong>🔢 Pixel Pitch:</strong> <span id="out-pixel">_________</span></div>
                            <div class="dimensoes-item"><strong>🗂️ Gabinete (LxA):</strong> <span id="out-gabinete-dim">_________</span></div>
                            <div class="dimensoes-item"><strong>💡 Brilho:</strong> <span id="out-brilho">_________</span></div>
                            <div class="dimensoes-item"><strong>🛡️ IP:</strong> <span id="out-ip">_________</span></div>
                            <div class="dimensoes-item"><strong>⚡ Consumo:</strong> <span id="out-consumo">_________</span></div>
                            <div class="dimensoes-item"><strong>🔄 Refresh:</strong> <span id="out-refresh">_________</span></div>
                            <div class="dimensoes-item"><strong>⚖️ Peso/Gab.:</strong> <span id="out-peso">_________</span></div>
                            <div class="dimensoes-item"><strong>🔍 Scan:</strong> <span id="out-scan">_________</span></div>
                        </div>
                    </div>

                    <div class="clausula clausula-valores-ocultavel">
                        <div class="clausula-title"><i class="fas fa-coins"></i> CLÁUSULA 3ª - DO PREÇO E FORMA DE PAGAMENTO</div>
                        <div class="clausula-text">1. O valor total da transação é de <strong>R$ <span id="out-total-final2">0,00</span></strong>.<br>2. Condição de pagamento: <span class="highlight" id="out-cond-pag2">_________</span>.<br>3. Dados bancários: PIX (CNPJ 43.738.727/0001-83) ou Banco do Brasil, Ag. 6504-8, C/C 23623-3.</div>
                    </div>

                    
                    <div class="clausula">
                        <div class="clausula-title"><i class="fas fa-truck"></i> CLÁUSULA 4ª - DA ENTREGA, INSTALAÇÃO E PENALIDADES</div>
                        <div class="clausula-text">1. Prazo e local: A entrega e a instalação do equipamento estão previstas para até <span class="highlight" id="out-prazo-entrega2">_________</span>, a serem realizadas no endereço indicado pelo COMPRADOR: <span class="highlight" id="out-end-inst2">O MESMO</span>, podendo este prazo ser alterado mediante acordo prévio entre ambas as partes.<br>2. Multa por atraso da Vendedora: caso a instalação não ocorra no prazo estipulado por culpa exclusiva da VENDEDORA, ressalvadas greves ou paralisações de órgãos competentes, incidirá multa de 0,5% ao dia sobre o valor total do contrato, limitada a 10%.<br>3. Rescisão por falta de entrega: caso o produto não seja entregue, o contrato será rescindido com a devolução integral dos valores pagos ao COMPRADOR.<br>4. Inadimplência do Comprador: o atraso no pagamento sujeita o COMPRADOR ao ressarcimento de todas as despesas de cobrança judicial ou extrajudicial.</div>
                    </div>

                    
                    <div class="clausula">
                        <div class="clausula-title"><i class="fas fa-microchip"></i> CLÁUSULA 5ª - DAS OBRIGAÇÕES TÉCNICAS DO COMPRADOR</div>
                        <div class="clausula-text">Para a viabilização da instalação, o COMPRADOR obriga-se a disponibilizar no local:<br>• <strong>Energia Elétrica:</strong> ponto de energia 220V com quadro de distribuição exclusivo e devidamente aterrado.<br>• <strong>Conectividade:</strong> ponto de internet cabeada (RJ45) com sinal estável próximo à controladora.<br>• <strong>Estrutura de Apoio:</strong> garantir sustentação estrutural para o peso do painel e estrutura metálica.</div>
                    </div>

                    
                    
                </div>
                <div class="footer-view" style="padding:12px 0;border-top:2px solid #e67e22;text-align:center;">
                    <img src="../wp-content/uploads/2026/04/logo-rpshow-sem-fundo.png" alt="RP Show" style="height:28px;width:auto;opacity:.7;vertical-align:middle;margin-right:8px;" onerror="this.style.display='none'">
                    <strong style="color:#e67e22;letter-spacing:1px;">RPSHOW LED SERVICE</strong> · Tecnologia Visual de Alta Performance<br>
                    <i class="fas fa-building"></i> RPSHOW COMÉRCIO DE IMPORTAÇÃO E EXPORTAÇÃO LTDA | CNPJ: 43.738.727/0001-83<br>
                    <i class="fas fa-phone"></i> (16) 98220-8695 | <i class="fas fa-envelope"></i> contato@rpshow.com.br | www.rpshow.com.br
                </div>
            </div>
        </div>


        <!-- PÁGINA 3 DO CONTRATO -->
        <div class="a4-wrapper">
            <div id="pagina3" class="a4-sheet">
                <div class="watermark">
                    <img src="../wp-content/uploads/2026/04/logo-rpshow-sem-fundo.png" alt="RP Show" style="max-height:85px;width:auto;display:block;margin:0 auto;" onerror="this.style.opacity='0.3'">
                </div>
                <div id="pagina3-content">

                <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;border-bottom:2px solid #e67e22;margin-bottom:14px;">
                    <img src="../wp-content/uploads/2026/04/logo-rpshow-sem-fundo.png" alt="RP Show" style="max-height:85px;width:auto;display:block;margin:0 auto;" onerror="this.style.opacity='0.3'">
                    <div style="text-align:right;font-size:10px;color:#7f8c8d;font-weight:bold;">CONTRATO PARTICULAR DE COMPRA,<br>VENDA E INSTALAÇÃO DE EQUIPAMENTOS ELETRÔNICOS</div>
                </div>
                    
                    <div class="clausula">
                        <div class="clausula-title"><i class="fas fa-shield-alt"></i> CLÁUSULA 6ª - DA GARANTIA</div>
                        <div class="clausula-text">1. Prazo: <span class="highlight" id="out-garantia2">365</span> dias de garantia eletrônica e estrutural contra defeitos de fabricação.<br>A garantia não cobre: Mau uso ou negligência; Oscilações ou falhas elétricas; Danos causados por terceiros; Instalações inadequadas.<br>2. Exclusões e perda: danos por técnicos não autorizados ou violação de lacres.<br>3. Manutenção: custo de deslocamento durante a garantia <strong>R$ <span class="highlight" id="out-deslocamento2">600,00</span></strong> por conta do COMPRADOR.<br>4. Desistência: valor da entrada poderá ser retido em materiais personalizados.</div>
                    </div>

                        <div class="clausula">
                        <div class="clausula-title"><i class="fas fa-handshake"></i> CLÁUSULA 7ª - DA RESERVA DE DOMÍNIO</div>
                        <div class="clausula-text">Até a quitação total do contrato, o equipamento permanecerá como propriedade da VENDEDORA.</div>
                    </div>

                    
                    <div class="clausula">
                        <div class="clausula-title"><i class="fas fa-gavel"></i> CLÁUSULA 8ª - DO FORO</div>
                        <div class="clausula-text">Fica eleito o foro da comarca de <strong>Ribeirão Preto/SP</strong>.</div>
                    </div>

                    

                    <div class="consideracoes-box">
                        <div class="clausula-title"><i class="fas fa-clipboard-list"></i> CONSIDERAÇÕES FINAIS</div>
                        <div class="clausula-text" id="out-consideracoes" style="white-space:pre-wrap;">Nenhuma consideração adicional.</div>
                    </div>

                    <div class="fotos-projeto-container">
                        <div class="foto-box"><img id="out-foto-1" alt="Foto 1"><span>FOTO 1</span></div>
                        <div class="foto-box"><img id="out-foto-2" alt="Foto 2"><span>FOTO 2</span></div>
                        <div class="foto-box"><img id="out-foto-3" alt="Foto 3"><span>FOTO 3</span></div>
                    </div>

                    <div class="data-local-box">
                        <strong>Ribeirão Preto/SP</strong>, <span id="out-data-assinatura"></span>
                    </div>

                    <div class="assinaturas">
                        <div class="assinatura-box"><div class="assinatura-linha"></div><strong id="out-razao2">_________</strong><br>COMPRADOR</div>
                        <div class="assinatura-box"><div class="assinatura-linha"></div><strong>RPSHOW COM. IMP. E EXP. LTDA</strong><br>VENDEDORA</div>
                    </div>
                    
                    <div class="testemunhas">
                        <div class="assinatura-box"><div class="assinatura-linha"></div><strong><span id="out-test1-nome">Fernando José da Silva</span></strong><br>CPF: <span id="out-test1-cpf">122.283.868-04</span></div>
                        <div class="assinatura-box"><div class="assinatura-linha"></div><strong><span id="out-test2-nome">Fabiola Cristina Gabriel da Silva</span></strong><br>CPF: <span id="out-test2-cpf">308.244.962-92</span></div>
                    </div>

                    
                </div>
                <div class="footer-view" style="padding:12px 0;border-top:2px solid #e67e22;text-align:center;">
                    <img src="../wp-content/uploads/2026/04/logo-rpshow-sem-fundo.png" alt="RP Show" style="height:28px;width:auto;opacity:.7;vertical-align:middle;margin-right:8px;" onerror="this.style.display='none'">
                    <strong style="color:#e67e22;letter-spacing:1px;">RPSHOW LED SERVICE</strong> · Tecnologia Visual de Alta Performance<br>
                    <i class="fas fa-building"></i> RPSHOW COMÉRCIO DE IMPORTAÇÃO E EXPORTAÇÃO LTDA | CNPJ: 43.738.727/0001-83<br>
                    <i class="fas fa-phone"></i> (16) 98220-8695 | <i class="fas fa-envelope"></i> contato@rpshow.com.br | www.rpshow.com.br
                </div>
            </div>
        </div>

        <div class="pdf-footer">
            <button class="btn-pdf-master btn-pdf" onclick="gerarPDFDefinitivo()">
                <i class="fas fa-file-pdf"></i> BAIXAR CONTRATO
            </button>
        </div>
    </div>
</div>


<script>
    // ===== Segurança: escapa HTML para evitar XSS ao injetar dados em innerHTML =====
    function escHtml(v){
        if (v === null || v === undefined) return '';
        return String(v)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
    let congelarNumero = false;
    let exibirTodosContratos = false;

    const modelosConfig = {
        "P1.2mm Indoor":   { pixelMM:1.2, resGabL:512, resGabA:384,  gabLargura:0.64, gabAltura:0.48, nomeGabinete:"640x480 mm",  brilho:"800 nits", ip:"IP43", peso:"7.5 kg",  consumo:"130W/380W",  refresh:"7680Hz", scan:"1/43" },
        "P1.8mm Indoor":   { pixelMM:1.8, resGabL:344, resGabA:258,  gabLargura:0.64, gabAltura:0.48, nomeGabinete:"640x480 mm",  brilho:"1000 nits", ip:"IP43", peso:"8 kg",   consumo:"150W/420W",  refresh:"7680Hz", scan:"1/32" },
        "P2.5mm Outdoor":  { pixelMM:2.5, resGabL:384, resGabA:384,  gabLargura:0.96, gabAltura:0.96, nomeGabinete:"960x960 mm",  brilho:"4500 nits", ip:"IP65", peso:"25 kg",  consumo:"320W/850W",  refresh:"7680Hz", scan:"1/16" },
        "P2.97mm Outdoor 500x1000": { pixelMM:2.97, resGabL:168, resGabA:336, gabLargura:0.50, gabAltura:1.00, nomeGabinete:"500x1000 mm", brilho:"5000 nits", ip:"IP65", peso:"13 kg",  consumo:"360W/850W",  refresh:"7680Hz", scan:"1/16" },
        "P3.91mm Outdoor 500x1000": { pixelMM:3.91, resGabL:128, resGabA:256, gabLargura:0.50, gabAltura:1.00, nomeGabinete:"500x1000 mm", brilho:"5000 nits", ip:"IP65", peso:"14 kg",  consumo:"380W/900W",  refresh:"7680Hz", scan:"1/16" },
        "P4mm Outdoor":    { pixelMM:4, resGabL:240, resGabA:240,    gabLargura:0.96, gabAltura:0.96, nomeGabinete:"960x960 mm",  brilho:"5500 nits", ip:"IP65", peso:"26 kg",  consumo:"350W/900W",  refresh:"7680Hz", scan:"1/10" },
        "P5mm Outdoor":    { pixelMM:5, resGabL:192, resGabA:192,    gabLargura:0.96, gabAltura:0.96, nomeGabinete:"960x960 mm",  brilho:"6000 nits", ip:"IP65", peso:"28 kg",  consumo:"380W/980W",  refresh:"7680Hz", scan:"1/8"  },
        "P6mm Outdoor":    { pixelMM:6, resGabL:160, resGabA:160,    gabLargura:0.96, gabAltura:0.96, nomeGabinete:"960x960 mm",  brilho:"6200 nits", ip:"IP65", peso:"29 kg",  consumo:"400W/1000W", refresh:"7680Hz", scan:"1/6"  },
        "P8mm Outdoor":    { pixelMM:8, resGabL:120, resGabA:120,    gabLargura:0.96, gabAltura:0.96, nomeGabinete:"960x960 mm",  brilho:"7000 nits", ip:"IP65", peso:"30 kg",  consumo:"450W/1100W", refresh:"7680Hz", scan:"1/5"  },
        "P10mm Outdoor":   { pixelMM:10, resGabL:96, resGabA:96,   gabLargura:0.96, gabAltura:0.96, nomeGabinete:"960x960 mm",  brilho:"7500 nits", ip:"IP65", peso:"32 kg",  consumo:"480W/1200W", refresh:"7680Hz", scan:"1/4"  },
        "P2.5mm Indoor":   { pixelMM:2.5, resGabL:256, resGabA:192,  gabLargura:0.64, gabAltura:0.48, nomeGabinete:"640x480 mm",  brilho:"1000 nits", ip:"IP43", peso:"8.5 kg", consumo:"180W/480W",  refresh:"7680Hz", scan:"1/32" },
        "P2.97mm Indoor":  { pixelMM:2.97, resGabL:168, resGabA:168, gabLargura:0.50, gabAltura:0.50, nomeGabinete:"500x500 mm",  brilho:"1200 nits", ip:"IP43", peso:"8 kg",   consumo:"210W/520W",  refresh:"7680Hz", scan:"1/21" },
        "P2.97mm Indoor 500x1000": { pixelMM:2.97, resGabL:168, resGabA:336, gabLargura:0.50, gabAltura:1.00, nomeGabinete:"500x1000 mm", brilho:"1200 nits", ip:"IP43", peso:"13 kg",  consumo:"360W/850W",  refresh:"7680Hz", scan:"1/21" },
        "P3.91mm Indoor":  { pixelMM:3.91, resGabL:128, resGabA:128, gabLargura:0.50, gabAltura:0.50, nomeGabinete:"500x500 mm",  brilho:"1200 nits", ip:"IP43", peso:"8.5 kg", consumo:"240W/600W",  refresh:"7680Hz", scan:"1/16" },
        "P3.91mm Indoor 500x1000":  { pixelMM:3.91, resGabL:128, resGabA:256, gabLargura:0.50, gabAltura:1.00, nomeGabinete:"500x1000 mm",  brilho:"1200 nits", ip:"IP43", peso:"14 kg", consumo:"380W/900W",  refresh:"7680Hz", scan:"1/16" },
        "P4mm Indoor":     { pixelMM:4, resGabL:240, resGabA:240,    gabLargura:0.96, gabAltura:0.96, nomeGabinete:"960x960 mm",  brilho:"1500 nits", ip:"IP43", peso:"24 kg",  consumo:"300W/780W",  refresh:"7680Hz", scan:"1/10" },
        "P5mm Indoor":     { pixelMM:5, resGabL:192, resGabA:192,    gabLargura:0.96, gabAltura:0.96, nomeGabinete:"960x960 mm",  brilho:"1800 nits", ip:"IP43", peso:"26 kg",  consumo:"320W/850W",  refresh:"7680Hz", scan:"1/8"  },
        "P6mm Indoor":     { pixelMM:6, resGabL:160, resGabA:160,    gabLargura:0.96, gabAltura:0.96, nomeGabinete:"960x960 mm",  brilho:"2000 nits", ip:"IP43", peso:"27 kg",  consumo:"350W/900W",  refresh:"7680Hz", scan:"1/6"  },
        "P10mm Indoor":    { pixelMM:10, resGabL:96, resGabA:96,   gabLargura:0.96, gabAltura:0.96, nomeGabinete:"960x960 mm",  brilho:"2000 nits", ip:"IP43", peso:"28 kg",  consumo:"420W/1000W", refresh:"7680Hz", scan:"1/4"  }
    };

    const especificacoesPaineis = {
        "P1.2mm Indoor":   [{ label:"Gabinete", value:"512x384 mm" }, { label:"Res. Gabinete", value:"512x384 px" }, { label:"Módulo", value:"160x160 mm" }, { label:"Brilho", value:"800 nits" }, { label:"IP", value:"IP43" }, { label:"Peso/gab", value:"7.5 kg" }, { label:"Consumo", value:"130W/380W" }, { label:"Refresh", value:"7680Hz" }, { label:"Material", value:"Alu. Fundido"}, { label:"Sistema", value:"NovaStar" }, { label:"Scan", value:"1/43" }, { label:"Vida Útil", value:"100.000h" }],
        "P1.8mm Indoor":   [{ label:"Gabinete", value:"344x258 mm" }, { label:"Res. Gabinete", value:"344x258 px" }, { label:"Módulo", value:"320x160 mm" }, { label:"Brilho", value:"1000 nits" }, { label:"IP", value:"IP43" }, { label:"Peso/gab", value:"8 kg"  }, { label:"Consumo", value:"150W/420W" }, { label:"Refresh", value:"7680Hz" }, { label:"Material", value:"Alu. Fundido"}, { label:"Sistema", value:"NovaStar" }, { label:"Scan", value:"1/32" }, { label:"Vida Útil", value:"100.000h" }],
        "P2.5mm Outdoor":  [{ label:"Gabinete", value:"960x960 mm" }, { label:"Res. Gabinete", value:"384x384 px" }, { label:"Módulo", value:"320x160 mm" }, { label:"Brilho", value:"4500 nits" }, { label:"IP", value:"IP65" }, { label:"Peso/gab", value:"25 kg" }, { label:"Consumo", value:"320W/850W" }, { label:"Refresh", value:"7680Hz" }, { label:"Material", value:"Ferro/Alu." }, { label:"Sistema", value:"NovaStar" }, { label:"Scan", value:"1/16" }, { label:"Vida Útil", value:"100.000h" }],
        "P2.97mm Outdoor 500x1000": [{ label:"Gabinete", value:"500x1000 mm" }, { label:"Res. Gabinete", value:"168x336 px" }, { label:"Módulo", value:"250x250 mm" }, { label:"Brilho", value:"5000 nits" }, { label:"IP", value:"IP65" }, { label:"Peso/gab", value:"13 kg" }, { label:"Consumo", value:"360W/850W" }, { label:"Refresh", value:"7680Hz" }, { label:"Material", value:"Alu. Fundido" }, { label:"Sistema", value:"NovaStar" }, { label:"Scan", value:"1/16" }, { label:"Vida Útil", value:"100.000h" }],
        "P3.91mm Outdoor 500x1000": [{ label:"Gabinete", value:"500x1000 mm" }, { label:"Res. Gabinete", value:"128x256 px" }, { label:"Módulo", value:"250x250 mm" }, { label:"Brilho", value:"5000 nits" }, { label:"IP", value:"IP65" }, { label:"Peso/gab", value:"14 kg" }, { label:"Consumo", value:"380W/900W" }, { label:"Refresh", value:"7680Hz" }, { label:"Material", value:"Alu. Fundido" }, { label:"Sistema", value:"NovaStar" }, { label:"Scan", value:"1/16" }, { label:"Vida Útil", value:"100.000h" }],
        "P4mm Outdoor":    [{ label:"Gabinete", value:"960x960 mm" }, { label:"Res. Gabinete", value:"240x240 px" }, { label:"Módulo", value:"320x160 mm" }, { label:"Brilho", value:"5500 nits" }, { label:"IP", value:"IP65" }, { label:"Peso/gab", value:"26 kg" }, { label:"Consumo", value:"350W/900W" }, { label:"Refresh", value:"7680Hz" }, { label:"Material", value:"Ferro/Alu." }, { label:"Sistema", value:"NovaStar" }, { label:"Scan", value:"1/10" }, { label:"Vida Útil", value:"100.000h" }],
        "P4mm Indoor":     [{ label:"Gabinete", value:"960x960 mm" }, { label:"Res. Gabinete", value:"240x240 px" }, { label:"Módulo", value:"320x160 mm" }, { label:"Brilho", value:"1500 nits" }, { label:"IP", value:"IP43" }, { label:"Peso/gab", value:"24 kg" }, { label:"Consumo", value:"300W/780W" }, { label:"Refresh", value:"7680Hz" }, { label:"Material", value:"Ferro/Alu." }, { label:"Sistema", value:"NovaStar" }, { label:"Scan", value:"1/10" }, { label:"Vida Útil", value:"100.000h" }],
        "P5mm Outdoor":    [{ label:"Gabinete", value:"960x960 mm" }, { label:"Res. Gabinete", value:"192x192 px" }, { label:"Módulo", value:"320x160 mm" }, { label:"Brilho", value:"6000 nits" }, { label:"IP", value:"IP65" }, { label:"Peso/gab", value:"28 kg" }, { label:"Consumo", value:"380W/980W" }, { label:"Refresh", value:"7680Hz" }, { label:"Material", value:"Ferro/Alu." }, { label:"Sistema", value:"NovaStar" }, { label:"Scan", value:"1/8"  }, { label:"Vida Útil", value:"100.000h" }],
        "P5mm Indoor":     [{ label:"Gabinete", value:"960x960 mm" }, { label:"Res. Gabinete", value:"192x192 px" }, { label:"Módulo", value:"320x160 mm" }, { label:"Brilho", value:"1800 nits" }, { label:"IP", value:"IP43" }, { label:"Peso/gab", value:"26 kg" }, { label:"Consumo", value:"320W/850W" }, { label:"Refresh", value:"7680Hz" }, { label:"Material", value:"Ferro/Alu." }, { label:"Sistema", value:"NovaStar" }, { label:"Scan", value:"1/8"  }, { label:"Vida Útil", value:"100.000h" }],
        "P6mm Outdoor":    [{ label:"Gabinete", value:"960x960 mm" }, { label:"Res. Gabinete", value:"160x160 px" }, { label:"Módulo", value:"320x160 mm" }, { label:"Brilho", value:"6200 nits" }, { label:"IP", value:"IP65" }, { label:"Peso/gab", value:"29 kg" }, { label:"Consumo", value:"400W/1000W"}, { label:"Refresh", value:"7680Hz" }, { label:"Material", value:"Ferro/Alu." }, { label:"Sistema", value:"NovaStar" }, { label:"Scan", value:"1/6"  }, { label:"Vida Útil", value:"100.000h" }],
        "P8mm Outdoor":    [{ label:"Gabinete", value:"960x960 mm" }, { label:"Res. Gabinete", value:"120x120 px" }, { label:"Módulo", value:"320x160 mm" }, { label:"Brilho", value:"7000 nits" }, { label:"IP", value:"IP65" }, { label:"Peso/gab", value:"30 kg" }, { label:"Consumo", value:"450W/1100W"}, { label:"Refresh", value:"7680Hz" }, { label:"Material", value:"Ferro/Alu." }, { label:"Sistema", value:"NovaStar" }, { label:"Scan", value:"1/5"  }, { label:"Vida Útil", value:"100.000h" }],
        "P10mm Outdoor":   [{ label:"Gabinete", value:"960x960 mm" }, { label:"Res. Gabinete", value:"96x96 px"   }, { label:"Módulo", value:"320x160 mm" }, { label:"Brilho", value:"7500 nits" }, { label:"IP", value:"IP65" }, { label:"Peso/gab", value:"32 kg" }, { label:"Consumo", value:"480W/1200W"}, { label:"Refresh", value:"7680Hz" }, { label:"Material", value:"Ferro/Alu." }, { label:"Sistema", value:"NovaStar" }, { label:"Scan", value:"1/4"  }, { label:"Vida Útil", value:"100.000h" }],
        "P2.5mm Indoor":   [{ label:"Gabinete", value:"640x480 mm" }, { label:"Res. Gabinete", value:"256x192 px" }, { label:"Módulo", value:"320x160 mm" }, { label:"Brilho", value:"1000 nits" }, { label:"IP", value:"IP43" }, { label:"Peso/gab", value:"8.5 kg"}, { label:"Consumo", value:"180W/480W" }, { label:"Refresh", value:"7680Hz" }, { label:"Material", value:"Alu. Fundido"}, { label:"Sistema", value:"NovaStar" }, { label:"Scan", value:"1/32" }, { label:"Vida Útil", value:"100.000h" }],
        "P2.97mm Indoor":  [{ label:"Gabinete", value:"500x500 mm" }, { label:"Res. Gabinete", value:"168x168 px" }, { label:"Módulo", value:"250x250 mm" }, { label:"Brilho", value:"1200 nits" }, { label:"IP", value:"IP43" }, { label:"Peso/gab", value:"8 kg"  }, { label:"Consumo", value:"210W/520W" }, { label:"Refresh", value:"7680Hz" }, { label:"Material", value:"Alu. Fundido"}, { label:"Sistema", value:"NovaStar" }, { label:"Scan", value:"1/21" }, { label:"Vida Útil", value:"100.000h" }],
        "P2.97mm Indoor 500x1000": [{ label:"Gabinete", value:"500x1000 mm" }, { label:"Res. Gabinete", value:"168x336 px" }, { label:"Módulo", value:"250x250 mm" }, { label:"Brilho", value:"1200 nits" }, { label:"IP", value:"IP43" }, { label:"Peso/gab", value:"13 kg"  }, { label:"Consumo", value:"240W/600W" }, { label:"Refresh", value:"7680Hz" }, { label:"Material", value:"Alu. Fundido"}, { label:"Sistema", value:"NovaStar" }, { label:"Scan", value:"1/16" }, { label:"Vida Útil", value:"100.000h" }],
        "P3.91mm Indoor":  [{ label:"Gabinete", value:"500x500 mm" }, { label:"Res. Gabinete", value:"128x128 px" }, { label:"Módulo", value:"250x250 mm" }, { label:"Brilho", value:"1200 nits" }, { label:"IP", value:"IP43" }, { label:"Peso/gab", value:"8.5 kg"}, { label:"Consumo", value:"240W/600W" }, { label:"Refresh", value:"7680Hz" }, { label:"Material", value:"Alu. Fundido"}, { label:"Sistema", value:"NovaStar" }, { label:"Scan", value:"1/16" }, { label:"Vida Útil", value:"100.000h" }],
        "P3.91mm Indoor 500x1000":  [{ label:"Gabinete", value:"500x1000 mm" }, { label:"Res. Gabinete", value:"128x256 px" }, { label:"Módulo", value:"250x250 mm" }, { label:"Brilho", value:"1200 nits" }, { label:"IP", value:"IP43" }, { label:"Peso/gab", value:"8.5 kg"}, { label:"Consumo", value:"240W/600W" }, { label:"Refresh", value:"7680Hz" }, { label:"Material", value:"Alu. Fundido"}, { label:"Sistema", value:"NovaStar" }, { label:"Scan", value:"1/16" }, { label:"Vida Útil", value:"100.000h" }],
        "P6mm Indoor":     [{ label:"Gabinete", value:"960x960 mm" }, { label:"Res. Gabinete", value:"160x160 px" }, { label:"Módulo", value:"320x160 mm" }, { label:"Brilho", value:"2000 nits" }, { label:"IP", value:"IP43" }, { label:"Peso/gab", value:"27 kg" }, { label:"Consumo", value:"350W/900W" }, { label:"Refresh", value:"7680Hz" }, { label:"Material", value:"Ferro/Alu." }, { label:"Sistema", value:"NovaStar" }, { label:"Scan", value:"1/6"  }, { label:"Vida Útil", value:"100.000h" }],
        "P10mm Indoor":    [{ label:"Gabinete", value:"960x960 mm" }, { label:"Res. Gabinete", value:"96x96 px"   }, { label:"Módulo", value:"320x160 mm" }, { label:"Brilho", value:"2000 nits" }, { label:"IP", value:"IP43" }, { label:"Peso/gab", value:"28 kg" }, { label:"Consumo", value:"420W/1000W"}, { label:"Refresh", value:"7680Hz" }, { label:"Material", value:"Ferro/Alu." }, { label:"Sistema", value:"NovaStar" }, { label:"Scan", value:"1/4"  }, { label:"Vida Útil", value:"100.000h" }]
    };

    function gerarNumeroContrato() {
        let agora = new Date();
        return `CT-${agora.getFullYear()}${String(agora.getMonth() + 1).padStart(2, '0')}${String(agora.getDate()).padStart(2, '0')}-${String(agora.getHours()).padStart(2, '0')}${String(agora.getMinutes()).padStart(2, '0')}${String(agora.getSeconds()).padStart(2, '0')}`;
    }

    function atualizarNumeroContrato() {
        if (congelarNumero) return;
        let numElement = document.getElementById('numero-contrato');
        if(numElement) numElement.innerText = gerarNumeroContrato();
    }
    setInterval(atualizarNumeroContrato, 1000);

    function atualizarEspecificacoes() {
        let modelo = document.getElementById('in-modelo-painel').value;
        let grid = document.getElementById('grid-especificacoes-content');
        if (modelo && especificacoesPaineis[modelo]) {
            let html = '';
            especificacoesPaineis[modelo].forEach(item => { html += `<div class="grid-item"><strong>${item.label}:</strong> ${item.value}</div>`; });
            grid.innerHTML = html;
        } else {
            grid.innerHTML = '<div class="grid-item" style="grid-column:1/-1; text-align:center;">Selecione um modelo</div>';
        }
        calcularDimensoes();
    }

    
    function getOrientacao() {
        const h = document.getElementById('in-orientacao-gabinete-h');
        return (h && h.checked) ? 'horizontal' : 'vertical';
    }

    function verificarOrientacaoVisivel() {
        const modelo = document.getElementById('in-modelo-painel')?.value;
        const config = modelo ? modelosConfig[modelo] : null;
        const div = document.getElementById('div-orientacao-gabinete');
        if (!div) return;
        if (config && Math.abs(config.gabLargura - config.gabAltura) > 0.001) {
            div.style.display = 'block';
            const orient = getOrientacao();
            const bv = document.getElementById('btn-orient-vert');
            const bh = document.getElementById('btn-orient-horiz');
            if (bv) { bv.style.background  = orient==='vertical'   ? '#fff3e0' : '#f8f9fa';
                       bv.style.borderColor = orient==='vertical'   ? '#e67e22' : '#e0e0e0'; }
            if (bh) { bh.style.background  = orient==='horizontal' ? '#fff3e0' : '#f8f9fa';
                       bh.style.borderColor = orient==='horizontal' ? '#e67e22' : '#e0e0e0'; }
        } else {
            div.style.display = 'none';
        }
    }

function calcularDimensoes() {
        let modelo = document.getElementById('in-modelo-painel').value;
        let larguraM = parseFloat(document.getElementById('in-largura').value) || 0;
        let alturaM  = parseFloat(document.getElementById('in-altura').value)  || 0;

        verificarOrientacaoVisivel();

        if (!modelo || larguraM === 0 || alturaM === 0) {
            document.getElementById('calculo-resultado').innerHTML = 'Selecione um modelo e digite largura/altura para calcular';
            return;
        }
        let config = modelosConfig[modelo];
        if (!config) return;

        let pixelMM = config.pixelMM;
        let gabLarg = config.gabLargura;
        let gabAlt  = config.gabAltura;
        let resGabL = config.resGabL || Math.round(gabLarg * 1000 / pixelMM);
        let resGabA = config.resGabA || Math.round(gabAlt  * 1000 / pixelMM);

        // Para gabinetes retangulares (500x1000, etc.), respeita a orientacao escolhida
        const ehRetangular = Math.abs(config.gabLargura - config.gabAltura) > 0.001;
        const orientacao   = getOrientacao();
        let orientLabel = '';
        if (ehRetangular && orientacao === 'horizontal') {
            // Gira 90 graus: troca largura <-> altura do gabinete e da resolucao
            let tmp = gabLarg; gabLarg = gabAlt; gabAlt = tmp;
            tmp = resGabL; resGabL = resGabA; resGabA = tmp;
            orientLabel = ' (Horizontal/Girado 90°)';
        }

        // Quantidade de gabinetes (colunas x linhas)
        let cols = Math.round(larguraM / gabLarg);
        let rows = Math.round(alturaM  / gabAlt);
        if(cols<1) cols=1; if(rows<1) rows=1;
        let totalGabs = cols * rows;
        let areaTotal = (larguraM * alturaM).toFixed(2);
        // Resolucao total
        let resolucaoLargura = cols * resGabL;
        let resolucaoAltura  = rows * resGabA;

        document.getElementById('out-dim-painel').innerText  = `${larguraM.toFixed(2)}m x ${alturaM.toFixed(2)}m`;
        document.getElementById('out-area').innerText         = areaTotal;
        document.getElementById('out-resolucao').innerText    = `${resolucaoLargura} x ${resolucaoAltura} pixels`;
        document.getElementById('out-pixel').innerText        = `${pixelMM}mm`;
        document.getElementById('out-gabinete-dim').innerText = config.nomeGabinete + (ehRetangular && orientacao==='horizontal' ? ' (Horiz.)' : '');
        document.getElementById('out-gabinetes').innerText    = `${totalGabs} un (${cols}x${rows})`;

        let elCons = document.getElementById('out-consumo'); if(elCons) elCons.innerText = config.consumo || '_________';
        let elRef  = document.getElementById('out-refresh'); if(elRef)  elRef.innerText  = config.refresh || '_________';
        let elPeso = document.getElementById('out-peso');    if(elPeso) elPeso.innerText  = config.peso    || '_________';
        let elScan = document.getElementById('out-scan');    if(elScan) elScan.innerText  = config.scan    || '_________';
        let elBri  = document.getElementById('out-brilho');  if(elBri)  elBri.innerText   = config.brilho  || '_________';
        let elIP   = document.getElementById('out-ip');      if(elIP)   elIP.innerText    = config.ip      || '_________';

        document.getElementById('calculo-resultado').innerHTML =
            `✅ ${modelo} | ${larguraM.toFixed(2)}m x ${alturaM.toFixed(2)}m = ${areaTotal}m² | ${totalGabs} gabinetes | ${resolucaoLargura}x${resolucaoAltura}px${orientLabel}`;
        atualizarPreview();
    }

    function atualizarReceiver() {
        document.getElementById('out-modelo-receiver').innerText = document.getElementById('in-modelo-receiver').value || '_________';
    }
    
    function atualizarLote() {
        document.getElementById('out-lote-modulo').innerText = document.getElementById('in-lote-modulo').value || '_________';
    }

    function verificarCascataProdutos(id) {
        if(document.getElementById(`in-prod-${id}`).value.trim() !== '' && id < 5) {
            document.getElementById(`prod-linha-${id+1}`).style.display = 'flex';
        }
    }

    function parseMoeda(val) { if(!val) return 0; let num = val.replace(/\./g,'').replace(',','.'); return parseFloat(num)||0; }
    function formatarMoeda(v) { return v.toLocaleString('pt-BR',{minimumFractionDigits:2, maximumFractionDigits:2}); }

    // ===== ESTADO ESTRATÉGIA COMERCIAL (VENDAS) =====
    let modoPacote = false;

    function togglePacote() {
        modoPacote = !modoPacote;
        const btn = document.getElementById('btn-toggle-valores');
        const lbl = document.getElementById('btn-toggle-label');
        const icon = btn.querySelector('i');
        const divManual = document.getElementById('div-valor-manual');
        if (modoPacote) {
            btn.style.background = 'linear-gradient(135deg,#27ae60,#1e8449)';
            icon.className = 'fas fa-eye';
            lbl.textContent = 'Mostrar Valores Unitários';
            divManual.style.display = 'block';
        } else {
            btn.style.background = 'linear-gradient(135deg,#e67e22,#d35400)';
            icon.className = 'fas fa-eye-slash';
            lbl.textContent = 'Ocultar Valores Unitários';
            divManual.style.display = 'none';
        }
        calcularTotais();
    }

    function calcularTotais() {
        let subtotalCalc = 0;
        let itens = [];
        for(let i=1; i<=5; i++) {
            let prod = document.getElementById(`in-prod-${i}`)?.value || '';
            let qtd  = parseFloat(document.getElementById(`in-qtd-${i}`)?.value)||0;
            let vlr  = parseMoeda(document.getElementById(`in-vlr-${i}`)?.value||'');
            let total = qtd * vlr;
            if(prod.trim() !== '' || total > 0) {
                subtotalCalc += total;
                itens.push({ desc: prod, qtd, vlr, total });
            }
        }

        let vManual = parseFloat(document.getElementById('in-valor-manual')?.value)||0;
        let subOficial = (modoPacote && vManual > 0) ? vManual : subtotalCalc;

        let desc    = parseMoeda(document.getElementById('in-desc').value||'');
        let percImp = parseMoeda(document.getElementById('in-imposto').value||'');
        let base    = subOficial - desc;
        let imposto = base * (percImp / 100);
        let totalFinal = base + imposto;

        const fmt = v => v.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});

        let thead = document.getElementById('thead-produtos');
        let tbody = document.getElementById('view_produtos_rows');
        let tfoot = document.getElementById('tfoot-produtos');

        if (modoPacote) {
            thead.innerHTML = `<tr>
                <th style="background:#f8f9fa;color:#e67e22;padding:8px;text-align:left;width:60%">Produto</th>
                <th style="background:#f8f9fa;color:#e67e22;padding:8px;text-align:center;width:10%">Qtd</th>
                <th style="background:#f8f9fa;color:#e67e22;padding:8px;text-align:right;width:30%">TOTAL</th>
            </tr>`;
            let rows = '';
            itens.forEach((item, idx) => {
                rows += `<tr>
                    <td style="padding:8px;border-bottom:1px solid #dee2e6;"><strong>${item.desc}</strong></td>
                    <td style="text-align:center;padding:8px;border-bottom:1px solid #dee2e6;">${item.qtd}</td>`;
                if(idx === 0) {
                    rows += `<td rowspan="${itens.length}" style="text-align:center;vertical-align:middle;padding:12px;
                        background:#fff8f3;font-size:16px;font-weight:900;color:#e67e22;
                        border-left:2px solid #e67e22;border-bottom:1px solid #dee2e6;">
                        R$ ${fmt(subOficial)}</td>`;
                }
                rows += `</tr>`;
            });
            if(!rows) rows = '<tr><td colspan="3" style="text-align:center;color:#999;padding:12px;">Nenhum produto adicionado</td></tr>';
            tbody.innerHTML = rows;
            tfoot.innerHTML = `
                <tr><td colspan="3" style="text-align:right;padding:4px 8px;">
                    <span class="txt-desconto">Desconto: R$ ${fmt(desc)}</span></td></tr>
                <tr><td colspan="3" style="text-align:right;padding:4px 8px;">
                    <span class="txt-imposto">Impostos (${percImp.toFixed(0)}%): R$ ${fmt(imposto)}</span></td></tr>
                <tr style="background:#2c3e50;color:white;">
                    <td colspan="3" style="text-align:right;padding:10px;">
                        <strong>TOTAL FINAL: R$ <span id="out-total-final">${fmt(totalFinal)}</span></strong>
                    </td>
                </tr>`;
        } else {
            thead.innerHTML = `<tr>
                <th style="background:#f8f9fa;color:#e67e22;padding:8px;text-align:left;width:50%">Produto</th>
                <th style="background:#f8f9fa;color:#e67e22;padding:8px;text-align:center;width:10%">Qtd</th>
                <th style="background:#f8f9fa;color:#e67e22;padding:8px;text-align:right;width:20%">Valor Unitário</th>
                <th style="background:#f8f9fa;color:#e67e22;padding:8px;text-align:right;width:20%">Total</th>
            </tr>`;
            let rows = itens.map(item => `<tr>
                <td style="padding:8px;border-bottom:1px solid #dee2e6;"><strong>${item.desc}</strong></td>
                <td style="text-align:center;padding:8px;border-bottom:1px solid #dee2e6;">${item.qtd}</td>
                <td style="text-align:right;padding:8px;border-bottom:1px solid #dee2e6;">R$ ${fmt(item.vlr)}</td>
                <td style="text-align:right;padding:8px;border-bottom:1px solid #dee2e6;font-weight:bold;">R$ ${fmt(item.total)}</td>
            </tr>`).join('');
            if(!rows) rows = '<tr><td colspan="4" style="text-align:center;color:#999;padding:12px;">Nenhum produto adicionado</td></tr>';
            tbody.innerHTML = rows;
            tfoot.innerHTML = `
                <tr><td colspan="4" style="text-align:right;padding:4px 8px;">
                    <span class="txt-desconto">Desconto: R$ <span id="out-desc">${fmt(desc)}</span></span></td></tr>
                <tr><td colspan="4" style="text-align:right;padding:4px 8px;">
                    <span class="txt-imposto">Impostos (<span id="out-perc-imposto">${percImp.toFixed(0)}</span>%): R$ <span id="out-imposto">${fmt(imposto)}</span></span></td></tr>
                <tr style="background:#2c3e50;color:white;">
                    <td colspan="4" style="text-align:right;padding:10px;">
                        <strong>TOTAL FINAL: R$ <span id="out-total-final">${fmt(totalFinal)}</span></strong>
                    </td>
                </tr>`;
        }

        let elFinal2 = document.getElementById('out-total-final2');
        if(elFinal2) elFinal2.innerText = fmt(totalFinal);
        let elCondPag2 = document.getElementById('out-cond-pag2');
        if(elCondPag2) elCondPag2.innerText = document.getElementById('in-cond-pag')?.value || '_________';
        let elExtenso = document.getElementById('out-valor-extenso');
        if(elExtenso) elExtenso.innerText = numeroPorExtenso(totalFinal);
        atualizarPreview();
    }

    function numeroPorExtenso(valor) {
        if(valor === 0) return 'Zero reais';
        const unidades = ['', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
        const especiais = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
        const dezenas = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
        let inteiro = Math.floor(valor);
        let centavos = Math.round((valor - inteiro) * 100);
        function traduzirGrupo(n) {
            let texto = '';
            if(n >= 100) {
                let centena = Math.floor(n / 100);
                if(centena === 1 && n % 100 === 0) texto += 'cem';
                else {
                    const centenas = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
                    texto += centenas[centena];
                }
                n %= 100;
                if(n > 0) texto += ' e ';
            }
            if(n >= 20) {
                let dezena = Math.floor(n / 10);
                texto += dezenas[dezena];
                n %= 10;
                if(n > 0) texto += ' e ' + unidades[n];
            } else if(n >= 10) {
                texto += especiais[n - 10];
            } else if(n > 0) {
                texto += unidades[n];
            }
            return texto;
        }
        let textoFinal = '';
        if(inteiro >= 1000) {
            let milhar = Math.floor(inteiro / 1000);
            textoFinal += (milhar === 1 ? 'um mil' : traduzirGrupo(milhar) + ' mil');
            inteiro %= 1000;
            if(inteiro > 0) textoFinal += (inteiro < 100 ? ' e ' : ', ') + traduzirGrupo(inteiro);
        } else if(inteiro > 0) {
            textoFinal += traduzirGrupo(inteiro);
        }
        if(textoFinal !== '') textoFinal += (Math.floor(valor) === 1 ? ' real' : ' reais');
        if(centavos > 0) {
            if(textoFinal !== '') textoFinal += ' e ';
            textoFinal += traduzirGrupo(centavos) + (centavos === 1 ? ' centavo' : ' centavos');
        }
        return textoFinal.charAt(0).toUpperCase() + textoFinal.slice(1);
    }

    function atualizarPreview() {
        let campos = ['razao','cnpj','contato','ie','telefone','email','endereco','bairro','cidade','estado','cep','rep-nome','rep-cpf','rep-rg','rep-cargo','consideracoes', 'test1-nome', 'test1-cpf', 'test2-nome', 'test2-cpf'];
        campos.forEach(c => { 
            let val = document.getElementById(`in-${c}`)?.value || ''; 
            let out = document.getElementById(`out-${c}`); 
            if(out) {
                if(c === 'consideracoes') {
                    out.innerHTML = val ? val.replace(/\n/g, '<br>') : 'Nenhuma consideração adicional.';
                } else {
                    out.innerText = val || '_________';
                }
            }
        });
        document.getElementById('out-razao2').innerText = document.getElementById('in-razao').value || '_________';
        document.getElementById('out-cond-pag2').innerText = document.getElementById('in-cond-pag').value || '_________';
        let prazoVal = document.getElementById('in-prazo-entrega').value || '';
        let outPrazo = document.getElementById('out-prazo-entrega2');
        if(outPrazo) {
            if(prazoVal) {
                try {
                    let d = new Date(prazoVal + 'T12:00:00');
                    let dias = ['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
                    outPrazo.innerText = d.toLocaleDateString('pt-BR') + ' (' + dias[d.getDay()] + ')';
                } catch(e) { outPrazo.innerText = prazoVal; }
            } else { outPrazo.innerText = '_________'; }
        }
        let endInst = document.getElementById('in-end-inst').value;
        document.getElementById('out-end-inst2').innerText = (endInst && endInst.trim() !== '') ? endInst : 'O MESMO';
        document.getElementById('out-garantia2').innerText = document.getElementById('in-garantia').value || '365';
        document.getElementById('out-deslocamento2').innerText = document.getElementById('in-deslocamento').value || '600,00';
        let hoje = new Date();
        let meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
        document.getElementById('out-data-assinatura').innerText = `${hoje.getDate()} de ${meses[hoje.getMonth()]} de ${hoje.getFullYear()}`;
    }

    function carregarFotosMultiplas(input) {
        for (let i = 1; i <= 3; i++) {
            let imgTag = document.getElementById(`out-foto-${i}`);
            imgTag.src = ""; imgTag.style.display = 'none';
            if(imgTag.nextElementSibling) imgTag.nextElementSibling.style.display = 'inline';
        }
        if (input.files) {
            Array.from(input.files).slice(0, 3).forEach((file, index) => {
                let reader = new FileReader();
                let imgTag = document.getElementById(`out-foto-${index + 1}`);
                reader.onload = function(e) {
                    imgTag.src = e.target.result; imgTag.style.display = 'block';
                    if(imgTag.nextElementSibling) imgTag.nextElementSibling.style.display = 'none';
                }
                reader.readAsDataURL(file);
            });
        }
    }

    async function buscarDadosCNPJ() {
        let cnpjRaw = document.getElementById('in-cnpj').value.replace(/\D/g, '');
        if (cnpjRaw.length !== 14) {
            alert('⚠️ Digite um CNPJ válido com 14 dígitos.\nDígitos digitados: ' + cnpjRaw.length);
            return;
        }
        let botao = document.querySelector('.btn-buscar-cnpj');
        const origBtn = botao.innerHTML;
        botao.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Buscando...';
        botao.disabled = true;
        try {
            let response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjRaw}`);
            if (!response.ok) {
                let msg = response.status === 404 ? 'CNPJ não encontrado na Receita Federal.' : `Erro ${response.status} ao consultar.`;
                throw new Error(msg);
            }
            let dados = await response.json();
            document.getElementById('in-razao').value    = dados.razao_social || dados.nome || '';
            document.getElementById('in-endereco').value = [dados.logradouro, dados.numero].filter(Boolean).join(', ');
            document.getElementById('in-bairro').value   = dados.bairro || '';
            document.getElementById('in-cidade').value   = dados.municipio || '';
            document.getElementById('in-estado').value   = dados.uf || '';
            if (dados.cep) document.getElementById('in-cep').value = String(dados.cep).replace(/^(\d{5})(\d{3})$/, '$1-$2');
            if (dados.ddd_telefone_1) {
                let tel = dados.ddd_telefone_1.replace(/\D/g,'');
                if(tel.length >= 10) document.getElementById('in-telefone').value = tel.replace(/^(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3');
            }
            if (dados.email) document.getElementById('in-email').value = dados.email.toLowerCase();
            calcularTotais();
            atualizarPreview();
            alert('✅ Dados importados: ' + (dados.razao_social || dados.nome));
        } catch (error) {
            alert('❌ ' + (error.message || 'Erro ao buscar CNPJ. Verifique e tente novamente.'));
        } finally {
            botao.innerHTML = origBtn;
            botao.disabled = false;
        }
    }

    // ==================== ENGINE OPERACIONAL LOCALSTORAGE ====================
    
    function obterContratosLocais() {
        return JSON.parse(localStorage.getItem('rpshow_contratos') || '[]');
    }

    function toggleVerTodos() {
        exibirTodosContratos = !exibirTodosContratos;
        document.getElementById('btn-toggle-lista').innerText = exibirTodosContratos ? "Ocultar" : "Ver Todos";
        filtrarListaLocal();
    }

    function salvarContratoLocal() {
        let razao = document.getElementById('in-razao').value;
        if (!razao || razao.trim() === '') { alert("⚠️ Digite o nome ou Razão Social do cliente antes de salvar!"); return; }
        
        let contratos = obterContratosLocais();
        let idExistente = document.getElementById('in-contrato-id').value;

        // Garante que o número esteja gerado e congelado antes de salvar
        congelarNumero = true;
        let numContrato = document.getElementById('numero-contrato').innerText;
        if (!numContrato || numContrato === 'CARREGANDO...') {
            numContrato = gerarNumeroContrato();
            document.getElementById('numero-contrato').innerText = numContrato;
        }

        let dadosFormulario = {};
        document.querySelectorAll('.form-side input, .form-side select, .form-side textarea').forEach(el => {
            if (el.id && el.id !== 'campo-busca' && el.type !== 'file') dadosFormulario[el.id] = el.value;
        });

        let fotosFormulario = [];
        for (let i = 1; i <= 3; i++) {
            let img = document.getElementById(`out-foto-${i}`);
            if (img && img.src && img.src.startsWith('data:')) {
                fotosFormulario.push(img.src);
            }
        }

        if (idExistente) {
            let index = contratos.findIndex(c => c.id == idExistente);
            if (index !== -1) {
                contratos[index].razao_social = razao;
                contratos[index].cnpj = document.getElementById('in-cnpj').value;
                contratos[index].cidade = document.getElementById('in-cidade').value;
                contratos[index].dados = dadosFormulario;
                contratos[index].fotos = fotosFormulario;
                alert("✅ Alterações do contrato salvas com sucesso!");
            }
        } else {
            let novoId = Date.now();
            contratos.push({
                id: novoId, numero: numContrato, razao_social: razao,
                cnpj: document.getElementById('in-cnpj').value,
                cidade: document.getElementById('in-cidade').value,
                dados: dadosFormulario, fotos: fotosFormulario
            });
            document.getElementById('in-contrato-id').value = novoId;
            alert(`✅ Contrato ${numContrato} gravado com sucesso no Histórico!`);
        }
        localStorage.setItem('rpshow_contratos', JSON.stringify(contratos));
        filtrarListaLocal();
        // Salvar no banco do servidor (api.php local, tipo contrato_venda)
        (async()=>{
            try{
                const idiBanco = document.getElementById('in-banco-id') ? (document.getElementById('in-banco-id').value||0) : 0;
                const payload = {
                    id: idiBanco || 0,
                    numero: numContrato,
                    status: 'aberto',
                    razao_social: razao,
                    cnpj: document.getElementById('in-cnpj').value||'',
                    cidade: document.getElementById('in-cidade').value||'',
                    dados: dadosFormulario
                };
                const r = await fetch('api.php?acao=salvar&tipo=contrato_venda',{
                    method:'POST', headers:{'Content-Type':'application/json'},
                    body: JSON.stringify(payload)
                });
                const d = await r.json();
                if(d.ok){ console.log('✅ Banco: contrato salvo, id '+d.id); if(document.getElementById('in-banco-id')) document.getElementById('in-banco-id').value = d.id; }
                else console.warn('⚠️ Banco: '+(d.erro||'erro'));
            }catch(e){ console.warn('⚠️ Banco offline:', e.message); }
        })();
    }

    function filtrarListaLocal() {
        let contratos = obterContratosLocais();
        // Garante os mais novos primeiro (maior id = mais recente)
        contratos.sort((a, b) => (b.id || 0) - (a.id || 0));

        let campoBusca = document.getElementById('campo-busca');
        let termo = campoBusca ? campoBusca.value.toLowerCase().trim() : '';
        let container = document.getElementById('container-lista-contratos');
        if (!container) return;

        document.getElementById('lbl-contador-contratos').innerText = contratos.length;
        container.innerHTML = '';

        // Lista vazia: sem nenhum contrato salvo ainda
        if (contratos.length === 0) {
            container.innerHTML = '<div style="padding:20px;text-align:center;color:#999;font-size:12px;"><i class="fas fa-inbox" style="font-size:24px;display:block;margin-bottom:8px;"></i>Nenhum contrato salvo ainda.<br>Preencha e clique em <strong>Salvar Contrato</strong>.</div>';
            return;
        }

        let filtrados = contratos.filter(c => {
            if (!termo) return true;
            let num = (c.numero || '').toLowerCase();
            let nome = (c.razao_social || '').toLowerCase();
            let cidade = (c.cidade || '').toLowerCase();
            let cnpjLimpo = (c.cnpj || '').replace(/\D/g, '');
            let termoLimpo = termo.replace(/\D/g, '');
            return num.includes(termo) || nome.includes(termo) || cidade.includes(termo) ||
                   (termoLimpo.length >= 3 && cnpjLimpo.includes(termoLimpo));
        });

        // Sem resultados para o filtro digitado
        if (filtrados.length === 0) {
            container.innerHTML = `<div style="padding:16px;text-align:center;color:#e67e22;font-size:12px;"><i class="fas fa-search" style="display:block;margin-bottom:6px;font-size:20px;"></i>Nenhum contrato encontrado para "<strong>${termo}</strong>".</div>`;
            return;
        }

        let totalFiltrados = filtrados.length;
        let exibir = (!exibirTodosContratos && termo === '') ? filtrados.slice(0, 10) : filtrados;

        exibir.forEach(c => {
            let div = document.createElement('div');
            div.className = 'contrato-item';
            let dataStr = c.id ? new Date(c.id).toLocaleDateString('pt-BR') : '';
            div.innerHTML = `
                <div class="contrato-info" style="cursor:pointer" onclick="carregarContratoLocal(${c.id})">
                    <strong>${c.numero || 'S/N'}</strong>
                    <small>${c.razao_social || ''}</small>
                    <small style="color:#aaa;">${c.cidade || ''} ${dataStr ? '· ' + dataStr : ''}</small>
                </div>
                <div style="display:flex;gap:4px;align-items:center;">
                    <button type="button" class="btn-item btn-carregar-item" title="Carregar contrato" onclick="carregarContratoLocal(${c.id})"><i class="fas fa-folder-open"></i></button>
                    <button type="button" class="btn-item btn-deletar-item" title="Excluir contrato" onclick="apagarContratoLocal(${c.id})"><i class="fas fa-trash"></i></button>
                </div>`;
            container.appendChild(div);
        });

        if (!exibirTodosContratos && termo === '' && totalFiltrados > 10) {
            let aviso = document.createElement('div');
            aviso.style.cssText = "text-align:center;padding:8px;font-size:10px;color:#e67e22;background:#fff3e0;font-weight:bold;cursor:pointer;";
            aviso.innerHTML = `<i class="fas fa-chevron-down"></i> Ver todos os ${totalFiltrados} contratos`;
            aviso.onclick = toggleVerTodos;
            container.appendChild(aviso);
        }
    }

    function carregarContratoLocal(id) {
        let contratos = obterContratosLocais();
        let c = contratos.find(item => item.id == id);
        if (!c) return;

        limparFormularioSemConfirmacao();
        document.getElementById('in-contrato-id').value = c.id;
        congelarNumero = true;
        document.getElementById('numero-contrato').innerText = c.numero;

        for (let key in c.dados) {
            let el = document.getElementById(key);
            if (el) el.value = c.dados[key];
        }
        
        for (let i = 1; i <= 5; i++) {
            if (document.getElementById(`in-prod-${i}`)?.value) {
                document.getElementById(`prod-linha-${i}`).style.display = 'flex';
            }
        }

        if (c.fotos && c.fotos.length) {
            c.fotos.forEach((base64, idx) => {
                let imgTag = document.getElementById(`out-foto-${idx + 1}`);
                if (imgTag && base64) {
                    imgTag.src = base64; imgTag.style.display = 'block';
                    if (imgTag.nextElementSibling) imgTag.nextElementSibling.style.display = 'none';
                }
            });
        }

        calcularTotais();
        atualizarEspecificacoes();
        carregarModelosExtras();
        document.querySelector('.form-side').scrollTo({ top: 0, behavior: 'smooth' });
        alert(`📂 Contrato ${c.numero} carregado para alteração!`);
    }

    function apagarContratoLocal(id) {
        if(confirm("❌ Deseja realmente excluir este contrato permanentemente?")) {
            let filtrados = obterContratosLocais().filter(c => c.id != id);
            localStorage.setItem('rpshow_contratos', JSON.stringify(filtrados));
            if (document.getElementById('in-contrato-id').value == id) {
                limparFormularioSemConfirmacao();
                congelarNumero = false;
                document.getElementById('in-contrato-id').value = '';
                atualizarNumeroContrato();
            }
            filtrarListaLocal();
        }
    }

    function limparFormulario() {
        if (confirm("Deseja limpar a tela para criar um Novo Contrato?")) {
            congelarNumero = false;
            document.getElementById('in-contrato-id').value = '';
            limparFormularioSemConfirmacao();
            atualizarNumeroContrato();
            calcularTotais();
            atualizarEspecificacoes();
        }
    }

    function limparFormularioSemConfirmacao() {
        document.querySelectorAll('.form-side input, .form-side select, .form-side textarea').forEach(el => {
            if (el.id !== 'campo-busca' && el.type !== 'button') el.value = '';
        });
        document.getElementById('in-garantia').value = '365';
        document.getElementById('in-deslocamento').value = '600,00';
        document.getElementById('in-test1-nome').value = 'Fernando José da Silva';
        document.getElementById('in-test1-cpf').value = '122.283.868-04';
        document.getElementById('in-test2-nome').value = 'Fabiola Cristina Gabriel da Silva';
        document.getElementById('in-test2-cpf').value = '308.244.962-92';
        for(let i=2; i<=5; i++) document.getElementById(`prod-linha-${i}`).style.display = 'none';
        
        for (let i = 1; i <= 3; i++) {
            let img = document.getElementById(`out-foto-${i}`);
            img.src = ''; img.style.display = 'none';
            if (img.nextElementSibling) img.nextElementSibling.style.display = 'inline';
        }
    }

    async function gerarPDFDefinitivo() {
        const btn = document.querySelector('.btn-pdf');
        btn.innerHTML = "<i class='fas fa-spinner fa-spin'></i> GERANDO...";
        btn.disabled = true;
        try {
            const jsPDF = window.jspdf.jsPDF;
            const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
            const folhas = ['pagina1', 'pagina2', 'pagina3'];

            for (let i = 0; i < folhas.length; i++) {
                const element = document.getElementById(folhas[i]);
                const canvas = await html2canvas(element, { 
                    scale: 3, 
                    useCORS: true,
                    allowTaint: true,
                    logging: false,
                    backgroundColor: "#ffffff",
                    onclone: function(doc) {
                        // Forçar largura A4 exata (210mm = 794px a 96dpi)
                        doc.querySelectorAll('.a4-sheet').forEach(el => {
                            el.style.cssText = 'width:794px !important; min-height:1123px !important; padding:56px !important; transform:none !important; margin:0 !important; box-sizing:border-box !important;';
                        });
                        // Páginas 1 e 3 usam flex column com altura fixa para ancorar o rodapé
                        ['pagina1', 'pagina3'].forEach(id => {
                            const pg = doc.getElementById(id);
                            if (pg) {
                                pg.style.cssText += 'display:flex !important; flex-direction:column !important; height:1123px !important; min-height:unset !important;';
                            }
                        });
                        ['pagina1-content', 'pagina3-content'].forEach(id => {
                            const ct = doc.getElementById(id);
                            if (ct) {
                                ct.style.flex = '1 1 auto';
                                ct.style.overflow = 'hidden';
                                ct.style.minHeight = '0';
                            }
                        });
                        doc.querySelectorAll('.a4-wrapper').forEach(el => {
                            el.style.cssText = 'width:794px !important; transform:none !important; display:block !important; margin:0 !important;';
                        });
                        doc.querySelectorAll('.preview-side').forEach(el => {
                            el.style.cssText = 'width:794px !important; padding:0 !important;';
                        });
                        doc.querySelectorAll('.form-side').forEach(el => {
                            el.style.display = 'none';
                        });
                    }
                });
                const imgData = canvas.toDataURL("image/jpeg", 0.92);
                if (i > 0) pdf.addPage();
                // Encaixa pela largura A4 (210mm) e calcula a altura real; se passar de 297mm,
                // reduz proporcionalmente para caber sem cortar nenhuma cláusula.
                let alturaPDF = (canvas.height * 210) / canvas.width;
                if (alturaPDF > 297) {
                    const larguraEscalada = 210 * (297 / alturaPDF);
                    pdf.addImage(imgData, "JPEG", (210 - larguraEscalada) / 2, 0, larguraEscalada, 297);
                } else {
                    pdf.addImage(imgData, "JPEG", 0, 0, 210, alturaPDF);
                }
            }
            // Página 3 — Nota Promissória (se ativado)
            if (incluirNotaNoPDF) {
                gerarNotaPromissoria(); // preencher campos
                await new Promise(r => setTimeout(r, 300));
                const npDoc = document.getElementById('nota-promissoria-doc');
                const npBotoes = document.getElementById('np-botoes-acao');
                if(npBotoes) npBotoes.style.display = 'none';
                const npCanvas = await html2canvas(npDoc, { scale:2.5, useCORS:true, allowTaint:true, backgroundColor:'#ffffff', logging:false });
                if(npBotoes) npBotoes.style.display = '';
                document.getElementById('modalNotaPromissoria').classList.remove('ativo');
                pdf.addPage();
                pdf.addImage(npCanvas.toDataURL('image/jpeg',0.95), 'JPEG', 0, 0, 210, 297);
            }
            let nomeCliente = document.getElementById('in-razao').value || 'RPShow';
            let numContrato = document.getElementById('numero-contrato').innerText || '';
            pdf.save(`Contrato_${numContrato}_${nomeCliente}.pdf`);
        } catch (err) {
            alert("Erro ao gerar PDF: " + err.message);
        } finally {
            btn.innerHTML = "<i class='fas fa-file-pdf'></i> BAIXAR CONTRATO";
            btn.disabled = false;
        }
    }

    function enviarWhatsApp() {
        let tel = document.getElementById('in-telefone').value.replace(/\D/g, '');
        if(!tel) { alert('Digite o telefone do cliente!'); return; }
        if(tel.length < 10) { alert('Telefone inválido! Use DDD + número.'); return; }
        let numContrato = document.getElementById('numero-contrato').innerText;
        let razao = document.getElementById('in-razao').value || '';
        let msg = `Olá${razao ? ', ' + razao : ''}! 😊\n\nSegue o contrato *${numContrato}* da RP Show para sua análise e assinatura.\n\nQualquer dúvida estamos à disposição! 🤝`;
        window.open(`https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`, '_blank');
    }

    function enviarEmail() {
        let email = document.getElementById('in-email').value;
        if(!email) { alert('Digite o e-mail do cliente!'); return; }
        let numContrato = document.getElementById('numero-contrato').innerText;
        let razao = document.getElementById('in-razao').value || '';
        let assunto = encodeURIComponent(`Contrato ${numContrato} - RP Show`);
        let corpo = encodeURIComponent(`Prezado(a)${razao ? ' ' + razao : ''},\n\nSegue em anexo o contrato ${numContrato} da RP Show para análise e assinatura.\n\nAtenciosamente,\nEquipe RP Show\n(16) 98220-8695`);
        window.location.href = `mailto:${email}?subject=${assunto}&body=${corpo}`;
    }




    // ==================== MODELOS DE PAINEL - BANCO DE DADOS ====================
    const API_MODELOS = 'api.php';
    const API_SENHA = 'rpshow2026';
    const MODELOS_EXTRA_KEY = 'rpshow_modelos_extra'; // fallback localStorage

    // Carregar modelos do banco ao iniciar
    async function carregarModelosExtras() {
        try {
            const r = await fetch(`${API_MODELOS}?acao=listar_modelos&senha=${API_SENHA}&tipo=locacao`);
            const d = await r.json();
            if (d.ok && d.modelos.length > 0) {
                const sel = document.getElementById('in-modelo-painel');
                d.modelos.forEach(m => {
                    // Adicionar ao config em memória
                    modelosConfig[m.nome] = {
                        pixelMM: parseFloat(m.pixel_mm),
                        gabLargura: parseFloat(m.gab_largura),
                        gabAltura: parseFloat(m.gab_altura),
                        nomeGabinete: m.nome_gabinete,
                        brilho: m.brilho || '_________',
                        ip: m.ip || '_________',
                        consumo: m.consumo || '_________',
                        refresh: m.refresh || '_________',
                        peso: m.peso || '_________',
                        scan: m.scan || '_________',
                    };
                    especificacoesPaineis[m.nome] = [
                        { label:"Gabinete",      value: m.nome_gabinete },
                        { label:"Res. Gabinete", value: m.res_gabinete || '___x___ px' },
                        { label:"Módulo",        value: '___x___ mm' },
                        { label:"Brilho",        value: m.brilho },
                        { label:"IP",            value: m.ip },
                        { label:"Peso/gab",      value: m.peso },
                        { label:"Consumo",       value: m.consumo },
                        { label:"Refresh",       value: m.refresh },
                        { label:"Material",      value: m.material || '_________' },
                        { label:"Sistema",       value: 'NovaStar' },
                        { label:"Scan",          value: m.scan },
                        { label:"Vida Útil",     value: '100.000h' },
                    ];
                    // Adicionar ao select se não existir
                    if (!sel.querySelector(`option[value="${m.nome}"]`)) {
                        const opt = document.createElement('option');
                        opt.value = m.nome;
                        opt.textContent = `${m.nome} (Pixel ${m.pixel_mm}mm - Gabinete ${m.nome_gabinete})`;
                        opt.style.background = '#e8f5e9'; // verde = modelo personalizado
                        sel.appendChild(opt);
                    }
                });
                console.log(`✅ ${d.modelos.length} modelo(s) extra(s) carregado(s) do banco`);
            }
        } catch(e) {
            console.warn('Banco offline, usando modelos locais:', e.message);
        }
    }

    function abrirCadastroModelo() {
        document.getElementById('modalNovoModelo').style.display = 'flex';
        ['nm-nome','nm-pixel','nm-gab-larg','nm-gab-alt','nm-brilho','nm-ip',
         'nm-consumo','nm-refresh','nm-peso','nm-scan','nm-material','nm-res-gab'].forEach(id => {
            let el = document.getElementById(id); if(el) el.value = '';
        });
        document.getElementById('nm-preview').style.display = 'none';
        document.getElementById('nm-nome').focus();
        document.getElementById('nm-nome').oninput = atualizarPreviewModelo;
        document.getElementById('nm-gab-larg').oninput = atualizarPreviewModelo;
        document.getElementById('nm-gab-alt').oninput = atualizarPreviewModelo;
        document.getElementById('nm-pixel').oninput = atualizarPreviewModelo;
    }

    function atualizarPreviewModelo() {
        const nome  = document.getElementById('nm-nome').value;
        const pixel = document.getElementById('nm-pixel').value;
        const larg  = document.getElementById('nm-gab-larg').value;
        const alt   = document.getElementById('nm-gab-alt').value;
        if (nome) {
            let gabNome = (larg && alt) ? `${Math.round(larg*1000)}x${Math.round(alt*1000)} mm` : '___x___ mm';
            document.getElementById('nm-preview-txt').textContent =
                `${nome} (Pixel ${pixel||'?'}mm - Gabinete ${gabNome})`;
            document.getElementById('nm-preview').style.display = 'block';
        }
    }

    function fecharCadastroModelo() {
        document.getElementById('modalNovoModelo').style.display = 'none';
    }

    async function salvarNovoModelo() {
        const nome    = document.getElementById('nm-nome').value.trim();
        const pixel   = parseFloat(document.getElementById('nm-pixel').value);
        const gabLarg = parseFloat(document.getElementById('nm-gab-larg').value);
        const gabAlt  = parseFloat(document.getElementById('nm-gab-alt').value);

        if (!nome || !pixel || !gabLarg || !gabAlt) {
            alert('⚠️ Preencha: Nome, Pixel Pitch, Largura e Altura do Gabinete!');
            return;
        }

        const btnSalvar = document.querySelector('#modalNovoModelo button[onclick="salvarNovoModelo()"]');
        const origText = btnSalvar.innerHTML;
        btnSalvar.disabled = true;
        btnSalvar.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Salvando...";

        const dados = {
            nome, pixel_mm: pixel, gab_largura: gabLarg, gab_altura: gabAlt,
            brilho:       document.getElementById('nm-brilho').value,
            ip:           document.getElementById('nm-ip').value,
            consumo:      document.getElementById('nm-consumo').value,
            refresh:      document.getElementById('nm-refresh').value,
            peso:         document.getElementById('nm-peso').value,
            scan:         document.getElementById('nm-scan').value,
            material:     document.getElementById('nm-material').value,
            res_gabinete: document.getElementById('nm-res-gab').value,
        };

        try {
            const r = await fetch(`${API_MODELOS}?acao=salvar_modelo&senha=${API_SENHA}&tipo=locacao`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados)
            });
            const d = await r.json();

            if (d.ok) {
                // Adicionar em memória e no select
                const gabNome = `${Math.round(gabLarg*1000)}x${Math.round(gabAlt*1000)} mm`;
                modelosConfig[nome] = { pixelMM:pixel, gabLargura:gabLarg, gabAltura:gabAlt, nomeGabinete:gabNome,
                    brilho:dados.brilho||'_________', ip:dados.ip||'_________', consumo:dados.consumo||'_________',
                    refresh:dados.refresh||'_________', peso:dados.peso||'_________', scan:dados.scan||'_________' };

                const sel = document.getElementById('in-modelo-painel');
                if (!sel.querySelector(`option[value="${nome}"]`)) {
                    const opt = document.createElement('option');
                    opt.value = nome;
                    opt.textContent = `${nome} (Pixel ${pixel}mm - Gabinete ${gabNome})`;
                    opt.style.background = '#e8f5e9';
                    sel.appendChild(opt);
                }
                sel.value = nome;
                atualizarEspecificacoes();
                fecharCadastroModelo();
                alert(`✅ ${d.msg}\n\nDisponível em todos os dispositivos!`);
            } else {
                alert('❌ ' + d.erro);
            }
        } catch(e) {
            alert('❌ Erro ao conectar com o servidor: ' + e.message);
        } finally {
            btnSalvar.disabled = false;
            btnSalvar.innerHTML = origText;
        }
    }

    // ======================== ZOOM DA PRÉVIA ========================
    let _zoomManual = null; // null = auto-ajuste

    function calcularZoomAuto() {
        const prev = document.querySelector('.preview-side');
        if (!prev) return 0.85;
        const dispW = prev.clientWidth - 40; // descontar padding 20px × 2
        return Math.min(Math.max(dispW / 794, 0.35), 1.2); // 794px = 210mm @ 96dpi
    }

    function aplicarZoom(nivel) {
        const esc = (nivel !== null && nivel !== undefined) ? nivel : calcularZoomAuto();
        document.querySelectorAll('.a4-sheet').forEach(sheet => {
            const h = sheet.scrollHeight || 1123;
            sheet.style.transform = `scale(${esc})`;
            sheet.style.transformOrigin = 'top center';
            // compensa o espaço em layout que o scale não reduz
            sheet.style.marginBottom = `-${h * (1 - esc)}px`;
        });
        const lbl = document.getElementById('zoom-pct');
        if (lbl) lbl.textContent = Math.round(esc * 100) + '%';
    }

    function zoomMais()  { _zoomManual = Math.min((_zoomManual ?? calcularZoomAuto()) + 0.1, 1.5); aplicarZoom(_zoomManual); }
    function zoomMenos() { _zoomManual = Math.max((_zoomManual ?? calcularZoomAuto()) - 0.1, 0.3); aplicarZoom(_zoomManual); }
    function zoomReset() { _zoomManual = null; aplicarZoom(null); }

    // ======================== DIVISOR ARRASTÁVEL ========================
    document.addEventListener('DOMContentLoaded', function () {
        const divider = document.getElementById('drag-divider');
        const formS   = document.querySelector('.form-side');
        const prevS   = document.querySelector('.preview-side');
        if (!divider || !formS || !prevS) return;

        let dragging = false, startX = 0, startW = 0;

        divider.addEventListener('mousedown', function (e) {
            dragging = true;
            startX = e.clientX;
            startW = formS.offsetWidth;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            e.preventDefault();
        });
        document.addEventListener('mousemove', function (e) {
            if (!dragging) return;
            const w = Math.min(700, Math.max(360, startW + (e.clientX - startX)));
            formS.style.width = w + 'px';
            formS.style.flex  = '0 0 ' + w + 'px';
            if (_zoomManual === null) aplicarZoom(null); // recalcula auto-zoom
        });
        document.addEventListener('mouseup', function () {
            if (!dragging) return;
            dragging = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        });

        // Auto-zoom no redimensionamento da janela
        if (window.ResizeObserver) {
            new ResizeObserver(function () {
                if (_zoomManual === null) aplicarZoom(null);
            }).observe(prevS);
        }
        window.addEventListener('resize', function () {
            if (_zoomManual === null) aplicarZoom(null);
        });
    });
    // ================================================================

    window.onload = async () => { 
        // Máscaras de CNPJ apenas no campo CNPJ principal
        $('#in-cnpj').mask('00.000.000/0000-00');
        // Máscaras de CPF nos campos corretos
        $('#in-rep-cpf, #in-test1-cpf, #in-test2-cpf').mask('000.000.000-00');
        $('#in-telefone').mask('(00) 00000-0000');
        $('#in-cep').mask('00000-000');
        // Aplica máscara nos campos de valor e corrige timing:
        // oninput dispara ANTES do jQuery Mask reformatar → calcularTotais lia valor ainda cru.
        // Substituímos o handler inline por um setTimeout(30ms) para garantir que a leitura
        // aconteça sempre depois da máscara aplicar a formatação.
        for(let i=1; i<=5; i++) {
            $(`#in-vlr-${i}`).mask('000.000.000,00', {reverse: true});
            document.getElementById(`in-vlr-${i}`).oninput = function() {
                clearTimeout(window._vlrTimer);
                window._vlrTimer = setTimeout(calcularTotais, 30);
            };
        }
        $('#in-desc').mask('000.000.000,00', {reverse: true});
        document.getElementById('in-desc').oninput = function() {
            clearTimeout(window._vlrTimer);
            window._vlrTimer = setTimeout(calcularTotais, 30);
        };
        $('#in-deslocamento').mask('000.000.000,00', {reverse: true});
        
        atualizarNumeroContrato();
        calcularTotais();
        await carregarModelosExtras();
        atualizarEspecificacoes();
        filtrarListaLocal();

        // Se veio de uma proposta de venda, puxa os dados automaticamente
        // (aguarda os modelos carregarem primeiro para as especificações aparecerem)
        await carregarDaProposta();

        // Aplica zoom automático ao carregar
        setTimeout(() => aplicarZoom(null), 200);
    };

    // ==================== PUXAR DADOS DA PROPOSTA (DO SERVIDOR) ====================
    async function carregarDaProposta() {
        const params = new URLSearchParams(window.location.search);
        const propDbId = params.get('proposta_db');   // ID no banco MySQL
        const propLocalId = params.get('proposta');    // fallback local (compatibilidade)

        // 1) Tenta buscar no SERVIDOR (vale para qualquer computador)
        if (propDbId) {
            try {
                const r = await fetch('api.php?acao=buscar&tipo=proposta_comercial&id=' + encodeURIComponent(propDbId));
                const d = await r.json();
                if (d.ok && d.registro) {
                    let dados = d.registro.dados;
                    if (typeof dados === 'string') { try { dados = JSON.parse(dados); } catch(e){ dados = {}; } }
                    preencherContratoComDados(dados, d.registro.numero);
                    return;
                } else {
                    alert('⚠️ Proposta não encontrada no servidor (id ' + propDbId + ').');
                    return;
                }
            } catch(e) {
                alert('⚠️ Erro ao buscar a proposta no servidor. Verifique a conexão.');
                console.warn('carregarDaProposta:', e.message);
                return;
            }
        }

        // 2) Fallback: localStorage (só se abrir no mesmo PC, modo antigo)
        if (propLocalId) {
            let propostas = [];
            try { propostas = JSON.parse(localStorage.getItem('rpshow_contratos') || '[]'); } catch(e){ propostas = []; }
            const p = propostas.find(item => item.id == propLocalId);
            if (p) { preencherContratoComDados(p.dados || {}, p.numero, p.fotos); }
            else { alert('⚠️ Proposta não encontrada neste navegador.'); }
        }
    }

    // Preenche os campos do contrato a partir de um objeto de dados
    function preencherContratoComDados(dados, numeroProposta, fotos) {
        // Novo contrato (número próprio, não reaproveita o da proposta)
        document.getElementById('in-contrato-id').value = '';
        if (document.getElementById('in-banco-id')) document.getElementById('in-banco-id').value = '';
        congelarNumero = false;

        // Registra o número da proposta de origem
        if (numeroProposta) {
            const hid = document.getElementById('in-proposta-origem');
            if (hid) hid.value = numeroProposta;
            const box = document.getElementById('ref-proposta-box');
            const num = document.getElementById('ref-proposta-num');
            if (box && num) { num.textContent = numeroProposta; box.style.display = 'inline'; }
        }

        if (dados) {
            for (let key in dados) {
                let el = document.getElementById(key);
                if (el && el.type !== 'file') el.value = dados[key];
            }
        }

        // Garantir seleção do modelo do painel:
        // O select pode não ter a opção ainda se for modelo personalizado
        // ou se carregarModelosExtras() ainda não completou.
        const _modeloImportado = dados && dados['in-modelo-painel'];
        if (_modeloImportado) {
            const _selModelo = document.getElementById('in-modelo-painel');
            if (_selModelo) {
                _selModelo.value = _modeloImportado;
                if (_selModelo.value !== _modeloImportado) {
                    // Opção ainda não existe no select — criar entrada temporária
                    const _optExtra = document.createElement('option');
                    _optExtra.value       = _modeloImportado;
                    _optExtra.textContent = _modeloImportado;
                    _optExtra.setAttribute('data-importado', '1');
                    _selModelo.appendChild(_optExtra);
                    _selModelo.value = _modeloImportado;
                }
            }
        }

        // Orientacao do gabinete
        const orientSalva = dados['in-orientacao-gabinete'] || 'vertical';
        const rbVert  = document.getElementById('in-orientacao-gabinete');
        const rbHoriz = document.getElementById('in-orientacao-gabinete-h');
        if (rbVert && rbHoriz) {
            rbVert.checked  = (orientSalva === 'vertical');
            rbHoriz.checked = (orientSalva === 'horizontal');
        }

        // Mostra as linhas de produto preenchidas
        for (let i = 1; i <= 5; i++) {
            let pe = document.getElementById(`in-prod-${i}`);
            if (pe && pe.value && pe.value.trim() !== '') {
                let linha = document.getElementById(`prod-linha-${i}`);
                if (linha) linha.style.display = 'flex';
            }
        }

        // Fotos (se vieram do fallback local)
        if (fotos && fotos.length) {
            fotos.forEach((base64, idx) => {
                let imgTag = document.getElementById(`out-foto-${idx + 1}`);
                if (imgTag && base64) {
                    imgTag.src = base64; imgTag.style.display = 'block';
                    if (imgTag.nextElementSibling) imgTag.nextElementSibling.style.display = 'none';
                }
            });
        }

        atualizarNumeroContrato();
        calcularTotais();
        atualizarEspecificacoes();
        calcularDimensoes();
        try { $('#in-cnpj').trigger('input'); } catch(e){}

        if (document.querySelector('.form-side'))
            document.querySelector('.form-side').scrollTo({ top: 0, behavior: 'smooth' });
        setTimeout(function(){
            alert('✅ Dados da proposta ' + (numeroProposta || '') + ' carregados!\n\nConfira os campos, complete o que falta (representante, testemunhas) e salve o contrato.');
        }, 400);
    }

    // ==================== IMPORTAR PROPOSTA (modal com lista do servidor) ====================
    async function abrirImportarProposta() {
        let modal = document.getElementById('modal-importar-proposta');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'modal-importar-proposta';
            modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;';
            modal.innerHTML =
                '<div style="background:#fff;border-radius:12px;max-width:680px;width:100%;max-height:82vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.3);">' +
                  '<div style="background:linear-gradient(135deg,#16a34a,#0f7a37);color:#fff;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;">' +
                    '<div style="font-weight:800;font-size:16px;font-family:sans-serif;"><i class="fas fa-file-import"></i> Importar dados de uma Proposta</div>' +
                    '<button onclick="fecharImportarProposta()" style="background:rgba(255,255,255,.2);border:none;color:#fff;width:30px;height:30px;border-radius:6px;cursor:pointer;font-size:16px;">&times;</button>' +
                  '</div>' +
                  '<div style="padding:14px 18px;border-bottom:1px solid #eee;">' +
                    '<input type="text" id="busca-importar-proposta" onkeyup="renderImportarProposta(this.value)" placeholder="🔍 Buscar por cliente, CNPJ, número ou cidade..." style="width:100%;padding:11px 14px;border:1px solid #ccc;border-radius:8px;font-size:14px;box-sizing:border-box;">' +
                  '</div>' +
                  '<div id="lista-importar-proposta" style="overflow-y:auto;padding:10px 18px 18px;flex:1;font-family:sans-serif;"></div>' +
                '</div>';
            document.body.appendChild(modal);
        }
        modal.style.display = 'flex';
        document.getElementById('lista-importar-proposta').innerHTML = '<div style="padding:30px;text-align:center;color:#888;"><i class="fas fa-spinner fa-spin" style="font-size:24px;"></i><br><br>Carregando propostas do servidor...</div>';

        // Busca todas as propostas no servidor
        try {
            const r = await fetch('api.php?acao=listar&tipo=proposta_comercial');
            const d = await r.json();
            const registros = d.registros || d.propostas || [];
            window._propostasImportar = registros.map(reg => {
                let dd = reg.dados;
                if (typeof dd === 'string') { try { dd = JSON.parse(dd); } catch(e){ dd = {}; } }
                return {
                    id: reg.id,
                    numero: reg.numero || 'S/N',
                    razao: (dd && dd['in-razao']) || '—',
                    cnpj: (dd && dd['in-cnpj']) || '',
                    cidade: (dd && dd['in-cidade']) || '',
                    estado: (dd && dd['in-estado']) || '',
                    valor: (dd && dd['in-valor-manual']) || '',
                    dados: dd || {}
                };
            });
            renderImportarProposta('');
        } catch(e) {
            document.getElementById('lista-importar-proposta').innerHTML = '<div style="padding:30px;text-align:center;color:#e74c3c;">⚠️ Erro ao buscar propostas no servidor.<br><small>' + e.message + '</small></div>';
        }
    }

    function renderImportarProposta(filtro) {
        const cont = document.getElementById('lista-importar-proposta');
        let lista = window._propostasImportar || [];
        if (filtro && filtro.trim() !== '') {
            const f = filtro.toLowerCase();
            lista = lista.filter(p =>
                (p.razao||'').toLowerCase().includes(f) ||
                (p.numero||'').toLowerCase().includes(f) ||
                (p.cnpj||'').includes(f) ||
                (p.cidade||'').toLowerCase().includes(f)
            );
        }
        if (!lista.length) {
            cont.innerHTML = '<div style="padding:30px;text-align:center;color:#888;"><i class="fas fa-inbox" style="font-size:22px;"></i><br><br>Nenhuma proposta encontrada.</div>';
            return;
        }
        cont.innerHTML = lista.map(p => {
            const valorFmt = p.valor ? ('R$ ' + p.valor) : '';
            return '<div onclick="importarPropostaEscolhida(' + p.id + ')" style="border:1px solid #e5e7eb;border-radius:9px;padding:12px 14px;margin-bottom:8px;cursor:pointer;transition:.15s;display:flex;justify-content:space-between;align-items:center;gap:10px;" onmouseover="this.style.background=\'#f0fdf4\';this.style.borderColor=\'#16a34a\'" onmouseout="this.style.background=\'#fff\';this.style.borderColor=\'#e5e7eb\'">' +
                '<div style="min-width:0;">' +
                    '<div style="font-weight:800;color:#E67E22;font-size:13px;">' + escHtml(p.numero) + '</div>' +
                    '<div style="font-weight:700;font-size:14px;color:#111;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escHtml(p.razao) + '</div>' +
                    '<div style="font-size:12px;color:#888;">' + (p.cidade ? escHtml(p.cidade) + (p.estado?'/'+escHtml(p.estado):'') : '') + (p.cnpj ? ' · ' + escHtml(p.cnpj) : '') + '</div>' +
                '</div>' +
                '<div style="text-align:right;flex-shrink:0;">' +
                    (valorFmt ? '<div style="color:#16a34a;font-weight:700;font-size:13px;margin-bottom:4px;">' + valorFmt + '</div>' : '') +
                    '<span style="background:#16a34a;color:#fff;padding:5px 12px;border-radius:6px;font-size:12px;font-weight:700;"><i class="fas fa-file-import"></i> Importar</span>' +
                '</div>' +
            '</div>';
        }).join('');
    }

    function importarPropostaEscolhida(id) {
        const lista = window._propostasImportar || [];
        const p = lista.find(x => x.id == id);
        if (!p) { alert('⚠️ Proposta não encontrada.'); return; }
        fecharImportarProposta();
        preencherContratoComDados(p.dados, p.numero);
    }

    function fecharImportarProposta() {
        const modal = document.getElementById('modal-importar-proposta');
        if (modal) modal.style.display = 'none';
    }

    // ==================== BACKUP / IMPORTAÇÃO / DIAGNÓSTICO ====================

    function exportarBackup() {
        let contratos = obterContratosLocais();
        if (contratos.length === 0) {
            alert('⚠️ Nenhum contrato salvo para exportar!');
            return;
        }
        let json = JSON.stringify({ versao: '1.0', exportado: new Date().toISOString(), contratos: contratos }, null, 2);
        let blob = new Blob([json], { type: 'application/json' });
        let url = URL.createObjectURL(blob);
        let a = document.createElement('a');
        a.href = url;
        a.download = `backup_contratos_rpshow_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        alert(`✅ Backup de ${contratos.length} contrato(s) exportado com sucesso!`);
    }

    function importarBackup(input) {
        let file = input.files[0];
        if (!file) return;
        let reader = new FileReader();
        reader.onload = function(e) {
            try {
                let dados = JSON.parse(e.target.result);
                let importados = Array.isArray(dados) ? dados : (dados.contratos || []);
                if (!importados.length) throw new Error('Arquivo sem contratos válidos.');

                let existentes = obterContratosLocais();
                let idsExistentes = existentes.map(c => c.id);
                let novos = importados.filter(c => !idsExistentes.includes(c.id));
                let atualizados = importados.filter(c => idsExistentes.includes(c.id));

                let merged = [...existentes];
                atualizados.forEach(c => {
                    let idx = merged.findIndex(e => e.id === c.id);
                    if (idx !== -1) merged[idx] = c;
                });
                merged = [...merged, ...novos];

                localStorage.setItem('rpshow_contratos', JSON.stringify(merged));
                filtrarListaLocal();
                alert(`✅ Importação concluída!\n📥 ${novos.length} novo(s) | 🔄 ${atualizados.length} atualizado(s)\nTotal: ${merged.length} contrato(s) no histórico.`);
            } catch(err) {
                alert('❌ Erro ao importar: ' + err.message + '\nVerifique se o arquivo é um backup válido da RP Show.');
            }
            input.value = '';
        };
        reader.readAsText(file);
    }

    function diagnosticarStorage() {
        try {
            let contratos = obterContratosLocais();
            let testKey = '__rpshow_test__';
            localStorage.setItem(testKey, '1');
            localStorage.removeItem(testKey);
            let url = window.location.href.substring(0, 80);
            alert(
                '📊 DIAGNÓSTICO DO ARMAZENAMENTO\n\n' +
                '✅ localStorage: FUNCIONANDO\n' +
                '📁 Contratos salvos: ' + contratos.length + '\n' +
                '🔑 Chave usada: rpshow_contratos\n' +
                '🌐 Origem: ' + window.location.origin + '\n\n' +
                '⚠️ IMPORTANTE: O histórico funciona apenas quando\n' +
                'o arquivo é aberto do MESMO local.\n\n' +
                (contratos.length > 0 
                    ? '📋 Último salvo: ' + (contratos[contratos.length-1].razao_social || 'S/N')
                    : '💡 Use "Exportar Backup" para salvar seus contratos\nem um arquivo .json e "Importar" em qualquer PC.')
            );
        } catch(err) {
            alert('❌ localStorage BLOQUEADO!\n\nSeu navegador está impedindo o armazenamento local.\nSolução: Abra o arquivo diretamente no navegador\n(não via preview/iframe).\n\nErro: ' + err.message);
        }
    }


    // ==================== NOTA PROMISSÓRIA (VENDAS - sem NP, só fechar) ====================
    // Vendas não tem nota promissória mas os modais existem no HTML
    let incluirNotaNoPDF = false;

    function fecharNotaPromissoria() {
        let m = document.getElementById('modalNotaPromissoria');
        if(m) m.classList.remove('ativo');
    }
    function gerarPDFNotaPromissoria() { alert('Nota Promissória não disponível no Contrato de Vendas.'); }
    function adicionarNPaoPDF() { alert('Nota Promissória não disponível no Contrato de Vendas.'); }

    // ==================== GERENCIADOR DE STORAGE ====================
    function mgObterChave() {
        const cands = ['rpshow_contratos','rpshow_vendas','contratos'];
        for(let k of cands){ try{ let a=JSON.parse(localStorage.getItem(k)||'[]'); if(Array.isArray(a)&&a.length>0&&a[0].numero) return k; }catch{} }
        for(let i=0;i<localStorage.length;i++){ let k=localStorage.key(i); try{ let a=JSON.parse(localStorage.getItem(k)); if(Array.isArray(a)&&a.length>0&&a[0].numero) return k; }catch{} }
        return 'rpshow_contratos';
    }
    function mgObter(){ try{ return JSON.parse(localStorage.getItem(mgObterChave())||'[]'); }catch{ return []; } }
    function mgLog(msg){ let el=document.getElementById('mg-log'); if(el){ el.style.display='block'; el.innerHTML+=`<div>> ${new Date().toLocaleTimeString()} — ${msg}</div>`; el.scrollTop=el.scrollHeight; } }
    function mgCalcEspaco(){ try{ let t=0; for(let k in localStorage){if(localStorage.hasOwnProperty(k))t+=(localStorage[k].length+k.length)*2;} return t>1048576?(t/1048576).toFixed(2)+' MB':(t/1024).toFixed(1)+' KB'; }catch{return '?';} }

    function abrirGerenciador(){
        let m = document.getElementById('modalGerenciador');
        if(m){ m.classList.add('ativo'); mgAtualizar(); }
    }
    function fecharGerenciador(){
        let m = document.getElementById('modalGerenciador');
        if(m) m.classList.remove('ativo');
    }
    function mgAtualizar(){
        try{
            let c=mgObter(), ch=mgObterChave();
            let st=document.getElementById('mg-status'); if(st){ st.textContent='FUNCIONANDO'; st.className='mbadge v'; }
            let tot=document.getElementById('mg-total'); if(tot) tot.textContent=c.length;
            let esp=document.getElementById('mg-espaco'); if(esp) esp.textContent=mgCalcEspaco();
            let chEl=document.getElementById('mg-chave'); if(chEl) chEl.textContent=ch;
            let lbl=document.getElementById('lbl-contador-contratos'); if(lbl) lbl.textContent=c.length;
        }catch(e){
            let st=document.getElementById('mg-status'); if(st){ st.textContent='BLOQUEADO'; st.className='mbadge r'; }
        }
    }
    function mgScan(){
        let el=document.getElementById('mg-scan-result'); if(!el) return;
        el.style.display='block'; el.innerHTML='';
        if(localStorage.length===0){ el.innerHTML='<span style="color:#e74c3c;">❌ localStorage vazio nesta origem.</span>'; return; }
        el.innerHTML=`<strong style="color:#e67e22;">📦 ${localStorage.length} chave(s):</strong><br>`;
        let achou=false;
        for(let i=0;i<localStorage.length;i++){
            let k=localStorage.key(i); let val=localStorage.getItem(k);
            let tam=((val.length*2)/1024).toFixed(1)+' KB'; let extra='';
            try{ let a=JSON.parse(val); if(Array.isArray(a)&&a.length>0&&a[0].numero){ extra=`<span style="color:#27ae60;font-weight:bold;"> ✅ CONTRATOS (${a.length})</span>`; achou=true; } }catch{}
            el.innerHTML+=`<div style="padding:3px 0;font-size:11px;border-bottom:1px solid #eee;"><span style="color:#e67e22;">${k}</span> — ${tam}${extra}</div>`;
        }
        if(!achou) el.innerHTML+='<br><span style="color:#f39c12;">⚠️ Nenhum contrato encontrado nesta origem.</span>';
        else { el.innerHTML+='<br><span style="color:#27ae60;">✅ Localizados!</span>'; mgAtualizar(); filtrarListaLocal(); }
    }
    function mgToggleLista(){
        let el=document.getElementById('mg-lista'); if(!el) return;
        if(el.style.display==='block'){el.style.display='none';return;}
        let c=mgObter(); c.sort((a,b)=>(b.id||0)-(a.id||0));
        if(!c.length){el.innerHTML='<div style="color:#7f8c8d;text-align:center;padding:12px;font-size:11px;">Nenhum contrato.</div>';el.style.display='block';return;}
        el.innerHTML=c.map(ct=>`
            <div class="mlista-item">
                <div style="flex:1;cursor:pointer;" onclick="fecharGerenciador();carregarContratoLocal(${ct.id})">
                    <strong>${escHtml(ct.numero||'S/N')}</strong>
                    <small style="display:block;color:#7f8c8d;">${escHtml(ct.razao_social||'')} ${ct.cidade?'· '+escHtml(ct.cidade):''}</small>
                    <small style="display:block;color:#aaa;font-size:10px;">${ct.id?new Date(ct.id).toLocaleString('pt-BR'):''}</small>
                </div>
                <button onclick="mgDeletar(${ct.id})" style="background:#e74c3c;color:white;border:none;padding:4px 8px;border-radius:5px;cursor:pointer;font-size:10px;"><i class="fas fa-trash"></i></button>
            </div>`).join('');
        el.style.display='block';
    }
    function mgDeletar(id){
        if(!confirm('Excluir este contrato?'))return;
        let ch=mgObterChave(); let c=mgObter().filter(x=>x.id!=id);
        localStorage.setItem(ch,JSON.stringify(c));
        mgLog('🗑️ Excluído '+id+'. Restam: '+c.length);
        mgAtualizar(); mgToggleLista(); mgToggleLista(); filtrarListaLocal();
    }
    function mgExportar(){
        let c=mgObter(); if(!c.length){alert('Nenhum contrato para exportar!');return;}
        let blob=new Blob([JSON.stringify({versao:'1.0',tipo:'vendas',exportado:new Date().toISOString(),contratos:c},null,2)],{type:'application/json'});
        let a=document.createElement('a'); a.href=URL.createObjectURL(blob);
        a.download=`backup_vendas_rpshow_${new Date().toISOString().slice(0,10)}.json`; a.click();
        mgLog('✅ Exportados '+c.length+' contrato(s)');
    }
    function mgImportar(input){
        let file=input.files[0]; if(!file)return;
        let reader=new FileReader();
        reader.onload=e=>{
            try{
                let dados=JSON.parse(e.target.result);
                let imp=Array.isArray(dados)?dados:(dados.contratos||[]);
                if(!imp.length)throw new Error('Sem contratos válidos.');
                let ch=mgObterChave(); let exist=mgObter(); let ids=exist.map(c=>c.id);
                let novos=imp.filter(c=>!ids.includes(c.id));
                let atualiz=imp.filter(c=>ids.includes(c.id));
                let merged=[...exist];
                atualiz.forEach(c=>{let i=merged.findIndex(e=>e.id===c.id);if(i!==-1)merged[i]=c;});
                merged=[...merged,...novos];
                localStorage.setItem(ch,JSON.stringify(merged));
                mgLog('📥 '+novos.length+' novos, '+atualiz.length+' atualizados. Total: '+merged.length);
                mgAtualizar(); filtrarListaLocal();
                alert('✅ '+novos.length+' novo(s) importado(s)!');
            }catch(err){alert('❌ '+err.message);}
            input.value='';
        };
        reader.readAsText(file);
    }
    function mgLimparTudo(){
        let c=mgObter(); if(!c.length){alert('Já está vazio!');return;}
        if(!confirm('⚠️ Apagar '+c.length+' contrato(s)?\n\nExporte o backup antes!'))return;
        if(!confirm('Confirmar: APAGAR TUDO?'))return;
        localStorage.removeItem(mgObterChave());
        mgLog('🧹 Limpo.');
        mgAtualizar(); filtrarListaLocal(); alert('✅ Storage limpo!');
    }

    // Fechar modais clicando fora
    document.addEventListener('DOMContentLoaded', () => {
        document.getElementById('modalGerenciador')?.addEventListener('click', function(e){ if(e.target===this) fecharGerenciador(); });
    });


// ── BUSCA DE CLIENTE + NOVO + EDITAR (padrão RPSHOW) ─────────────────────────
let _cacheClientes = null;
window.buscarClientePorNomeBtn = function(){ const i=document.getElementById('in-razao'); if(i&&i.value) buscarClientePorNome(i.value); else alert('Digite o nome ou CNPJ para buscar!'); };
window.buscarClientePorNome = async function(query){
    const box=document.getElementById('sugestoes-razao'); if(!box) return;
    if(!query||query.length<2){ box.style.display='none'; return; }
    try{
        if(!_cacheClientes){ const r=await fetch('api.php?acao=listar_clientes'); const d=await r.json(); _cacheClientes=Array.isArray(d)?d:(d.registros||d.clientes||[]); }
        const q=query.toLowerCase(); const vistos=new Set(); const enc=[];
        _cacheClientes.forEach(c=>{
            const nome=(c.razao_social||c.nome_fantasia||c.nome||'').trim();
            const cnpj=(c.cnpj_cpf||c.cnpj||'').trim();
            if(!nome||vistos.has(nome.toLowerCase())) return;
            if(nome.toLowerCase().includes(q)||cnpj.includes(q)){ vistos.add(nome.toLowerCase());
                enc.push({nome,cnpj,email:c.email||'',telefone:c.telefone||'',whatsapp:c.whatsapp||'',endereco:c.logradouro||c.endereco||'',numero:c.numero||'',bairro:c.bairro||'',cidade:c.cidade||'',estado:c.estado||'',cep:c.cep||''}); }
        });
        if(!enc.length){ box.style.display='none'; return; }
        window._cliSug=enc;
        box.innerHTML=enc.slice(0,6).map((e,i)=>`<div onclick="selCli(${i})" style="padding:10px 14px;cursor:pointer;border-bottom:1px solid rgba(255,255,255,.08);font-size:13px;color:#fff;" onmouseover="this.style.background='rgba(230,126,34,.2)'" onmouseout="this.style.background=''"><i class="fas fa-user" style="color:#E67E22;margin-right:8px;"></i><strong>${escHtml(e.nome)}</strong><span style="color:#94A3B8;font-size:11px;margin-left:8px;">${escHtml(e.cnpj||e.cidade||'')}</span></div>`).join('');
        const i=document.getElementById('in-razao'); const rect=i.getBoundingClientRect();
        box.style.position='fixed'; box.style.top=(rect.bottom+5)+'px'; box.style.left=rect.left+'px'; box.style.width=(rect.width-2)+'px'; box.style.display='block';
    }catch(err){ box.style.display='none'; }
};
function selCli(idx){
    const box=document.getElementById('sugestoes-razao'); if(box) box.style.display='none';
    const o=(window._cliSug||[])[idx]; if(!o) return;
    const mapa={'in-razao':o.nome,'in-cnpj':o.cnpj,'in-contato':o.contato,'in-telefone':o.telefone,'in-email':o.email,'in-endereco':o.endereco,'in-bairro':o.bairro,'in-cidade':o.cidade,'in-estado':o.estado,'in-cep':o.cep};
    Object.entries(mapa).forEach(([id,v])=>{ const el=document.getElementById(id); if(el&&v) el.value=v; });
    if(typeof atualizarPreview==='function') atualizarPreview();
}
document.addEventListener('click',e=>{ if(!e.target.closest('#sugestoes-razao')&&e.target.id!=='in-razao'){ const b=document.getElementById('sugestoes-razao'); if(b) b.style.display='none'; } });

// NOVO via ?novo=1
(function(){ const p=new URLSearchParams(location.search); if(p.get('novo')==='1'){ try{ const u=new URL(location.href); u.searchParams.delete('novo'); history.replaceState({},'',u.toString()); }catch(e){} } })();

// EDITAR via ?editar=NUMERO (carrega do banco)
(function(){
    const p=new URLSearchParams(location.search); const num=p.get('editar'); if(!num) return;
    fetch(`api.php?acao=buscar_numero&tipo=contrato_venda&numero=${encodeURIComponent(num)}`).then(r=>r.json()).then(data=>{
        if(data.ok&&data.proposta){ const c=data.proposta; let dados=c.dados||{}; if(typeof dados==='string'){ try{dados=JSON.parse(dados);}catch(e){dados={};} }
            for(let k in dados){ const el=document.getElementById(k); if(el) el.value=dados[k]; }
            const nE=document.getElementById('numero-contrato'); if(nE) nE.innerText=c.numero;
            const bE=document.getElementById('in-banco-id'); if(bE) bE.value=c.id;
            if(typeof atualizarPreview==='function') atualizarPreview();
            try{ const u=new URL(location.href); u.searchParams.delete('editar'); history.replaceState({},'',u.toString()); }catch(e){}
        }
    }).catch(console.error);
})();

    // ── Gerar PDF do Contrato ────────────────────────────────
    async function gerarPDFContrato() {
        var btn = document.querySelector('.btn-pdf-master');
        var orig = btn ? btn.innerHTML : '';
        if (btn) { btn.innerHTML = "<i class='fas fa-spinner fa-spin'></i> PREPARANDO..."; btn.disabled = true; }

        document.querySelectorAll('[id*="modal"],[class*="modal-overlay"]').forEach(function(el){ el.style.display='none'; });

        var formSide = document.querySelector('.form-side');
        if (formSide) formSide.style.display = 'none';

        document.querySelectorAll('.a4-wrapper').forEach(function(w){
            w.style.transform = 'none';
            w.style.marginBottom = '0';
        });

        await new Promise(function(r){ setTimeout(r, 300); });

        try {
            var jsPDF = window.jspdf.jsPDF;
            var pdf   = new jsPDF({orientation:'portrait', unit:'mm', format:'a4', compress:true});

            var allSheets = Array.from(document.querySelectorAll('.a4-sheet'));
            // Capturar a primeira por último (evita bug de canvas em branco)
            var captureOrder = allSheets.length > 1 ? allSheets.slice(1).concat(allSheets.slice(0,1)) : allSheets;

            var canvasMap = {};

            for (var i = 0; i < captureOrder.length; i++) {
                var folha = captureOrder[i];
                var pgId  = folha.id;

                if (btn) btn.innerHTML = "<i class='fas fa-spinner fa-spin'></i> Capturando " + (i+1) + "/" + captureOrder.length + "...";

                folha.scrollIntoView({behavior:'instant', block:'start'});
                await new Promise(function(r){ setTimeout(r, 600); });

                try {
                    var canvas = await html2canvas(folha, {
                        scale: 2,
                        useCORS: true,
                        allowTaint: false,
                        backgroundColor: '#ffffff',
                        logging: false,
                        imageTimeout: 20000,
                        onclone: function(doc) {
                            doc.querySelectorAll('canvas').forEach(function(c){
                                if (c.width === 0 || c.height === 0) c.remove();
                            });
                        }
                    });
                    if (canvas && canvas.width > 0 && canvas.height > 0) {
                        canvasMap[pgId] = canvas;
                    }
                } catch(e) { console.error('Erro ' + pgId + ': ' + e.message); }
            }

            var added = 0;
            for (var k = 0; k < allSheets.length; k++) {
                var id = allSheets[k].id;
                var c  = canvasMap[id];
                if (!c) continue;
                if (added > 0) pdf.addPage();
                pdf.addImage(c.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
                added++;
            }

            document.querySelectorAll('.a4-wrapper').forEach(function(w){
                w.style.transform = ''; w.style.marginBottom = '';
            });
            if (formSide) formSide.style.display = '';
            window.scrollTo({top:0, behavior:'smooth'});

            var num = (document.getElementById('numero-contrato')||{innerText:'CONTRATO'}).innerText.trim() || 'CONTRATO';
            pdf.save('Contrato_RPShow_' + num + '.pdf');

        } catch(e) {
            if (formSide) formSide.style.display = '';
            document.querySelectorAll('.a4-wrapper').forEach(function(w){ w.style.transform=''; w.style.marginBottom=''; });
            alert('Erro ao gerar PDF: ' + e.message);
        } finally {
            if (btn) { btn.innerHTML = orig; btn.disabled = false; }
        }
    }

</script>

<!-- MODAL GERENCIADOR DE STORAGE -->
<div class="modal-overlay" id="modalGerenciador">
  <div class="modal-box">
    <h2><i class="fas fa-database"></i> Gerenciador de Storage</h2>
    <p class="modal-sub">Gerencie os contratos salvos no armazenamento local deste navegador</p>

    <div class="modal-info">
      <div class="modal-info-row"><span>Status</span><span class="mbadge v" id="mg-status">...</span></div>
      <div class="modal-info-row"><span>Contratos salvos</span><span class="mbadge o" id="mg-total">...</span></div>
      <div class="modal-info-row"><span>Espaço usado</span><span style="color:#e67e22;font-size:11px;" id="mg-espaco">...</span></div>
      <div class="modal-info-row"><span>Chave detectada</span><span style="color:#3498db;font-size:11px;" id="mg-chave">rpshow_contratos</span></div>
    </div>

    <button class="mbtn mbtn-scan" onclick="mgScan()"><i class="fas fa-search"></i> Escanear Storage (encontrar contratos)</button>
    <div class="mscan" id="mg-scan-result"></div>

    <button class="mbtn" style="background:#E67E22;color:white;" onclick="mgToggleLista()"><i class="fas fa-list"></i> Ver / Gerenciar Contratos</button>
    <div class="mlista" id="mg-lista"></div>

    <hr class="msep">
    <button class="mbtn mbtn-exp" onclick="mgExportar()"><i class="fas fa-download"></i> Exportar Backup (.json)</button>
    <label class="mbtn mbtn-imp" style="cursor:pointer;margin-bottom:8px;">
      <i class="fas fa-upload"></i> Importar Backup (.json)
      <input type="file" accept=".json" onchange="mgImportar(this)" style="display:none;">
    </label>

    <hr class="msep">
    <div class="maviso"><i class="fas fa-exclamation-triangle"></i> Ações abaixo são <strong>irreversíveis</strong>!</div>
    <button class="mbtn mbtn-del" onclick="mgLimparTudo()"><i class="fas fa-trash-alt"></i> LIMPAR TODOS OS CONTRATOS</button>

    <div class="mlog" id="mg-log"></div>
    <button class="mbtn mbtn-close" onclick="fecharGerenciador()"><i class="fas fa-times"></i> Fechar</button>
  

<!-- MODAL CADASTRO DE NOVO MODELO -->
<div id="modalNovoModelo" style="display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:10000;align-items:center;justify-content:center;">
  <div style="background:white;border-radius:16px;padding:30px;max-width:560px;width:90%;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.4);">
    <h2 style="color:#1a3a5c;margin-bottom:6px;font-size:18px;"><i class="fas fa-microchip"></i> Cadastrar Novo Modelo de Painel</h2>
    <p style="color:#888;font-size:12px;margin-bottom:20px;">Preencha os dados técnicos. O modelo ficará disponível em todos os dispositivos.</p>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div>
        <label style="font-size:11px;font-weight:700;color:#555;text-transform:uppercase;display:block;margin-bottom:4px;">Nome do Modelo *</label>
        <input type="text" id="nm-nome" placeholder="Ex: P3.91mm Outdoor" style="width:100%;padding:9px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;">
        <small style="color:#888;font-size:10px;">Padrão: P3.91mm Outdoor</small>
      </div>
      <div>
        <label style="font-size:11px;font-weight:700;color:#555;text-transform:uppercase;display:block;margin-bottom:4px;">Pixel Pitch (mm) *</label>
        <input type="number" id="nm-pixel" placeholder="Ex: 3.91" step="0.01" style="width:100%;padding:9px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;">
      </div>
      <div>
        <label style="font-size:11px;font-weight:700;color:#555;text-transform:uppercase;display:block;margin-bottom:4px;">Largura Gabinete (m) *</label>
        <input type="number" id="nm-gab-larg" placeholder="Ex: 0.50" step="0.01" style="width:100%;padding:9px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;">
      </div>
      <div>
        <label style="font-size:11px;font-weight:700;color:#555;text-transform:uppercase;display:block;margin-bottom:4px;">Altura Gabinete (m) *</label>
        <input type="number" id="nm-gab-alt" placeholder="Ex: 1.00" step="0.01" style="width:100%;padding:9px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;">
      </div>
      <div>
        <label style="font-size:11px;font-weight:700;color:#555;text-transform:uppercase;display:block;margin-bottom:4px;">Brilho</label>
        <input type="text" id="nm-brilho" placeholder="Ex: 5000 nits" style="width:100%;padding:9px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;">
      </div>
      <div>
        <label style="font-size:11px;font-weight:700;color:#555;text-transform:uppercase;display:block;margin-bottom:4px;">IP</label>
        <input type="text" id="nm-ip" placeholder="Ex: IP65" style="width:100%;padding:9px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;">
      </div>
      <div>
        <label style="font-size:11px;font-weight:700;color:#555;text-transform:uppercase;display:block;margin-bottom:4px;">Consumo</label>
        <input type="text" id="nm-consumo" placeholder="Ex: 380W/900W" style="width:100%;padding:9px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;">
      </div>
      <div>
        <label style="font-size:11px;font-weight:700;color:#555;text-transform:uppercase;display:block;margin-bottom:4px;">Refresh</label>
        <input type="text" id="nm-refresh" placeholder="Ex: 7680Hz" style="width:100%;padding:9px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;">
      </div>
      <div>
        <label style="font-size:11px;font-weight:700;color:#555;text-transform:uppercase;display:block;margin-bottom:4px;">Peso/Gabinete</label>
        <input type="text" id="nm-peso" placeholder="Ex: 14 kg" style="width:100%;padding:9px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;">
      </div>
      <div>
        <label style="font-size:11px;font-weight:700;color:#555;text-transform:uppercase;display:block;margin-bottom:4px;">Scan</label>
        <input type="text" id="nm-scan" placeholder="Ex: 1/16" style="width:100%;padding:9px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;">
      </div>
      <div>
        <label style="font-size:11px;font-weight:700;color:#555;text-transform:uppercase;display:block;margin-bottom:4px;">Material</label>
        <input type="text" id="nm-material" placeholder="Ex: Alu. Fundido" style="width:100%;padding:9px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;">
      </div>
      <div>
        <label style="font-size:11px;font-weight:700;color:#555;text-transform:uppercase;display:block;margin-bottom:4px;">Resolução do Gabinete</label>
        <input type="text" id="nm-res-gab" placeholder="Ex: 128x256 px" style="width:100%;padding:9px;border:1.5px solid #ddd;border-radius:8px;font-size:13px;">
      </div>
    </div>
    <div id="nm-preview" style="display:none;background:#f0f5fa;border-radius:8px;padding:12px;margin-top:16px;font-size:12px;color:#1a3a5c;">
      <strong>Preview:</strong> <span id="nm-preview-txt" style="font-family:monospace;"></span>
    </div>
    <div style="display:flex;gap:10px;margin-top:20px;">
      <button onclick="salvarNovoModelo()" style="flex:1;background:linear-gradient(135deg,#27ae60,#1e8449);color:white;border:none;padding:12px;border-radius:10px;font-size:14px;font-weight:bold;cursor:pointer;">
        <i class="fas fa-save"></i> Salvar Modelo
      </button>
      <button onclick="fecharCadastroModelo()" style="background:#95a5a6;color:white;border:none;padding:12px 20px;border-radius:10px;font-size:14px;cursor:pointer;">
        Cancelar
      </button>
    </div>
  </div>
</div>

</body>
</html>