/* Leitura de faturas/prints com Gemini e eventos de colar/arrastar imagens. */
let invoiceImageMimeType = "image/png";

function setupPasteAndDropEvents() {
  window.addEventListener('paste', (event) => {
    const clipboardItems = (event.clipboardData || window.clipboardData)?.items;
    if (!clipboardItems) return;

    for (let item of clipboardItems) {
      if (item.type && item.type.startsWith('image/')) {
        const blob = item.getAsFile();
        if (blob) {
          event.preventDefault();
          openOcrModal();
          loadAndPreviewImage(blob);
          showToast('Print colado com sucesso!', 'info');
          break;
        }
      }
    }
  });

  const dropZone = document.getElementById('ocrDropZone');
  if (dropZone) {
    ['dragenter', 'dragover'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('border-purple-400', 'bg-purple-900/30', 'scale-[1.01]');
      });
    });

    ['dragleave', 'dragend'].forEach(eventName => {
      dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('border-purple-400', 'bg-purple-900/30', 'scale-[1.01]');
      });
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('border-purple-400', 'bg-purple-900/30', 'scale-[1.01]');

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file.type.startsWith('image/')) {
          loadAndPreviewImage(file);
          showToast(`Imagem "${file.name}" carregada!`, 'info');
        } else {
          showToast('Por favor, solte um arquivo de imagem (PNG, JPG, WEBP).', 'error');
        }
      }
    });
  }

  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());
}

function getStoredApiKey() {
  return (localStorage.getItem(STORAGE_GEMINI_KEY) || DEFAULT_API_KEY).trim();
}

function openApiKeyModal() {
  const input = document.getElementById('geminiApiKeyInput');
  input.value = localStorage.getItem(STORAGE_GEMINI_KEY) || DEFAULT_API_KEY;
  document.getElementById('apiKeyModal').classList.remove('hidden');
}

function closeApiKeyModal() {
  document.getElementById('apiKeyModal').classList.add('hidden');
}

function saveApiKey() {
  const keyVal = document.getElementById('geminiApiKeyInput').value.trim();
  if (!keyVal) {
    localStorage.removeItem(STORAGE_GEMINI_KEY);
    showToast('Chave de API removida.', 'info');
  } else {
    localStorage.setItem(STORAGE_GEMINI_KEY, keyVal);
    showToast('Chave da Gemini API salva com sucesso!', 'success');
  }
  closeApiKeyModal();
  updateApiKeyStatusBadge();
}

function updateApiKeyStatusBadge() {
  const savedKey = localStorage.getItem(STORAGE_GEMINI_KEY);
  const btnLabel = document.getElementById('apiKeyBtnLabel');
  if (savedKey && savedKey.length > 5) {
    if (btnLabel) btnLabel.textContent = 'API Ativa';
  } else {
    if (btnLabel) btnLabel.textContent = 'Chave API';
  }
}

function openOcrModal() {
  document.getElementById('ocrModal').classList.remove('hidden');
  updateApiKeyStatusBadge();
}

function closeOcrModal() {
  document.getElementById('ocrModal').classList.add('hidden');
  clearOcrState();
}

function clearOcrState() {
  base64InvoiceImage = null;
  document.getElementById('invoiceFileInput').value = '';
  document.getElementById('ocrPreviewContainer').classList.add('hidden');
  document.getElementById('ocrLoading').classList.add('hidden');
  document.getElementById('ocrErrorBox').classList.add('hidden');
  document.getElementById('ocrProcessBtn').disabled = true;
}

function handleInvoiceImageSelected(event) {
  const file = event.target.files?.[0];
  if (file) loadAndPreviewImage(file);
}

function loadAndPreviewImage(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const fullBase64 = e.target.result;
    base64InvoiceImage = fullBase64.split(',')[1];
    invoiceImageMimeType = file.type === "image/jpeg" || file.type === "image/webp" ? file.type : "image/png";
    
    const previewImg = document.getElementById('ocrImagePreview');
    previewImg.src = fullBase64;
    document.getElementById('ocrPreviewContainer').classList.remove('hidden');
    document.getElementById('ocrProcessBtn').disabled = false;
    document.getElementById('ocrImageInfo').textContent = `${file.name || 'Imagem colada'} (${Math.round(file.size / 1024)} KB)`;
  };
  reader.readAsDataURL(file);
}

async function processInvoiceWithGemini() {
  if (!base64InvoiceImage) {
    showToast('Por favor, carregue uma imagem primeiro!', 'error');
    return;
  }

  const apiKey = getStoredApiKey();
  const ocrLoading = document.getElementById('ocrLoading');
  const ocrLoadingText = document.getElementById('ocrLoadingText');
  const ocrErrorBox = document.getElementById('ocrErrorBox');
  const processBtn = document.getElementById('ocrProcessBtn');

  if (!apiKey) {
    ocrErrorBox.innerHTML = `<strong>Chave da API não encontrada!</strong><br>Você pode encontrar e gerar sua chave gratuita da API do Gemini acessando o <a href="https://aistudio.google.com/apikey" target="_blank" class="underline text-amber-400 font-bold">Google AI Studio</a>. Depois, cadastre-a no menu superior em <strong>Opções > Chave API</strong>.`;
    ocrErrorBox.classList.remove('hidden');
    showToast('Configure sua chave da API do Gemini.', 'error');
    return;
  }

  ocrLoading.classList.remove('hidden');
  ocrErrorBox.classList.add('hidden');
  processBtn.disabled = true;
  ocrLoadingText.textContent = 'Enviando imagem para análise da IA...';

  const prompt = `Analise a imagem da tabela ou fatura de despesas e extraia os itens listados.
Retorne EXCLUSIVAMENTE um array JSON válido sem markdown e sem explicações.
Formato exato de cada item:
{
  "title": "Nome do lançamento",
  "date": "YYYY-MM-DD",
  "installmentValue": 0.00,
  "isInstallment": true/false,
  "currentInstallment": 1,
  "installments": 1,
  "totalAmount": 0.00
}`;

  const payload = {
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType: invoiceImageMimeType,
              data: base64InvoiceImage
            }
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json"
    }
  };

  // Consulta os modelos realmente liberados para a chave informada.
  // Evita depender de uma lista fixa de modelos descontinuados.
  async function listAvailableVisionModels() {
    const models = [];
    let pageToken = '';
    for (let page = 0; page < 5; page++) {
      const params = new URLSearchParams({ pageSize: '100' });
      if (pageToken) params.set('pageToken', pageToken);
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?${params}`, {
        headers: { 'x-goog-api-key': apiKey }
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(`Não foi possível consultar os modelos (HTTP ${res.status}): ${body.error?.message || 'Verifique sua chave e a conexão.'}`);
      models.push(...(body.models || []));
      pageToken = body.nextPageToken || '';
      if (!pageToken) break;
    }
    const eligible = models.filter(model =>
      (model.supportedGenerationMethods || []).includes('generateContent') &&
      /^models\/gemini-/i.test(model.name || '') &&
      !/embedding|image-generation|tts|audio|live|robotics|computer-use|2\.0|1\.5|2\.5-flash-lite/i.test(model.name || '')
    );
    const score = name => {
      const n = name.toLowerCase();
      if (/gemini-3\.5-flash-lite/.test(n)) return 0;
      if (/gemini-3\.5-flash/.test(n)) return 1;
      if (/gemini-3.*flash/.test(n)) return 2;
      if (/gemini-2\.5-flash/.test(n)) return 3;
      if (/flash/.test(n)) return 4;
      return 10;
    };
    return eligible.sort((a, b) => score(a.name) - score(b.name)).map(m => m.name.replace(/^models\//, ''));
  }

  try {
    let response = null;
    let lastErrorText = '';
    ocrLoadingText.textContent = 'Verificando modelos disponíveis para sua chave...';
    const candidateModels = await listAvailableVisionModels();
    if (!candidateModels.length) throw new Error('Sua chave não possui modelos Gemini compatíveis com generateContent. Consulte o Google AI Studio.');

    for (const modelName of candidateModels) {
      ocrLoadingText.textContent = `Analisando com ${modelName}...`;
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent`;
      try {
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          response = res;
          break;
        }
        const errBody = await res.json().catch(() => ({}));
        lastErrorText = `Erro ${res.status} (${modelName}): ${errBody.error?.message || 'Falha na API.'}`;
        // Falhas de credencial, permissão ou cota não devem disparar novas tentativas.
        if ([401, 403, 429].includes(res.status)) break;
      } catch (netErr) {
        lastErrorText = `Erro de conexão: ${netErr.message}`;
        break;
      }
    }
    if (!response) throw new Error(lastErrorText || 'Nenhum modelo disponível conseguiu analisar a imagem.');

    const result = await response.json();
    let rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) throw new Error('A IA não retornou o texto estruturado da imagem.');

    rawText = rawText.trim();
    if (rawText.startsWith('```json')) {
      rawText = rawText.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (rawText.startsWith('```')) {
      rawText = rawText.replace(/^```/, '').replace(/```$/, '').trim();
    }

    const startIdx = rawText.indexOf('[');
    const endIdx = rawText.lastIndexOf(']');
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      rawText = rawText.substring(startIdx, endIdx + 1);
    }

    const extractedItems = JSON.parse(rawText);
    if (!Array.isArray(extractedItems) || extractedItems.length === 0) {
      throw new Error('Nenhum item detectado no print.');
    }

    const currentData = getCurrentMonthData();
    const ym = appDb.selectedMonth || new Date().toISOString().slice(0, 7);

    const formattedNewItems = extractedItems.map((item, index) => {
      let dateStr = /^\d{4}-\d{2}-\d{2}$/.test(String(item.date || '')) ? item.date : `${ym}-01`;
      const isInst = Boolean(item.isInstallment) || (Number(item.installments) > 1);
      const currentInst = Number(item.currentInstallment) || 1;
      const totalInst = isInst ? (Number(item.installments) || 2) : 1;
      const parseAmount = value => {
        if (typeof value === "number") return Number.isFinite(value) ? value : 0;
        const v = String(value ?? "").replace(/R\$|\s/g, "");
        const normalized = v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v;
        const n = Number(normalized);
        return Number.isFinite(n) ? n : 0;
      };
      const instVal = parseAmount(item.installmentValue ?? item.amount ?? item.valor);
      const totAmount = parseAmount(item.totalAmount) || (instVal * totalInst);
      const itemTitle = String(item.title || item.lancamento || item.descricao || 'Compra').trim();

      return {
        id: 'card_ai_' + Date.now() + '_' + index + '_' + Math.random().toString(36).substr(2, 4),
        title: itemTitle,
        category: inferCategoryFromTitle(itemTitle),
        date: dateStr,
        installmentValue: instVal,
        isInstallment: isInst,
        currentInstallment: currentInst,
        installments: totalInst,
        totalAmount: totAmount,
        paid: false
      };
    });

    // Exibe os lançamentos para revisão; nada é gravado até a confirmação.
    await reviewInvoiceItems(formattedNewItems);

  } catch (err) {
    console.error('Erro OCR:', err);
    // Evita inserir respostas de serviços externos como HTML.
    ocrErrorBox.textContent = `Falha na leitura com IA: ${err.message}. Confira a chave, a conexão e os limites de uso no Google AI Studio.`;
    ocrErrorBox.classList.remove('hidden');
    showToast('Erro ao processar imagem com Gemini.', 'error');
  } finally {
    ocrLoading.classList.add('hidden');
    processBtn.disabled = false;
  }
}

// Modal independente: não exige alterações no index.html nem em outros módulos.
function reviewInvoiceItems(items) {
  return new Promise(resolve => {
    const old = document.getElementById('geminiReviewOverlay');
    if (old) old.remove();
    const overlay = document.createElement('div');
    overlay.id = 'geminiReviewOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(2,6,23,.9);display:flex;align-items:center;justify-content:center;padding:12px;box-sizing:border-box';
    const panel = document.createElement('section');
    panel.style.cssText = 'background:#101827;color:#f8fafc;border:1px solid #475569;border-radius:16px;width:min(980px,100%);max-height:94dvh;display:flex;flex-direction:column;padding:18px;box-sizing:border-box;font:14px system-ui,sans-serif';
    const heading = document.createElement('h2');
    heading.textContent = 'Conferir compras identificadas pela IA';
    heading.style.cssText = 'font-size:19px;font-weight:700;margin:0 0 6px';
    const description = document.createElement('p');
    description.textContent = 'Edite os lançamentos, confira as parcelas e desmarque o que não deseja importar. Nenhum dado foi salvo ainda.';
    description.style.cssText = 'color:#cbd5e1;margin:0 0 12px';
    const scroller = document.createElement('div');
    scroller.style.cssText = 'overflow:auto;min-height:0;flex:1';
    const table = document.createElement('table');
    table.style.cssText = 'border-collapse:collapse;width:100%;min-width:710px';
    const header = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ['Importar','Situação','Data','Descrição','Valor (R$)','Parcela','De','Total compra (R$)'].forEach(label => {
      const th = document.createElement('th'); th.textContent=label;
      th.style.cssText='text-align:left;padding:9px 6px;border-bottom:1px solid #475569;color:#cbd5e1;position:sticky;top:0;background:#101827';
      headerRow.appendChild(th);
    });
    header.appendChild(headerRow); table.appendChild(header);
    const tbody = document.createElement('tbody');
    const controls=[];
    const existingAtReview = (getCurrentMonthData()?.cardExpenses || []);
    const inputStyle='box-sizing:border-box;width:100%;min-width:0;background:#020617;border:1px solid #475569;border-radius:7px;color:white;padding:8px;font:inherit';
    const cell = (tr, control, width) => { const td=document.createElement('td');td.style.cssText='padding:6px 4px;border-bottom:1px solid #273449;min-width:'+width+'px';td.appendChild(control);tr.appendChild(td); };
    const makeInput = (type,value) => {const el=document.createElement('input');el.type=type;el.value=value;el.style.cssText=inputStyle;return el;};
    items.forEach(item => {
      const tr=document.createElement('tr');
      const checked=document.createElement('input');checked.type='checkbox';checked.checked=true;checked.style.width='20px';checked.style.height='20px';
      const badge=document.createElement('span');badge.style.cssText='display:inline-block;white-space:nowrap;padding:5px 7px;border-radius:7px;font-size:11px;font-weight:700';
      const date=makeInput('date',item.date);
      const title=makeInput('text',item.title);
      const amount=makeInput('text',Number(item.installmentValue).toFixed(2).replace('.',','));
      const current=makeInput('number',item.currentInstallment);current.min='1';current.step='1';
      const installments=makeInput('number',item.installments);installments.min='1';installments.step='1';
      const total=makeInput('text',Number(item.totalAmount).toFixed(2).replace('.',','));
      [checked,badge,date,title,amount,current,installments,total].forEach((el,i)=>cell(tr,el,[45,95,140,220,100,70,70,115][i]));
      tbody.appendChild(tr);controls.push({item,checked,badge,date,title,amount,current,installments,total,tr,initial:true});
    });
    table.appendChild(tbody);scroller.appendChild(table);
    const status=document.createElement('p');status.style.cssText='margin:12px 0;color:#93c5fd;font-weight:600';
    const buttons=document.createElement('div');buttons.style.cssText='display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap';
    const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancelar';
    const confirm=document.createElement('button');confirm.type='button';confirm.textContent='Importar selecionados';
    for(const btn of [cancel,confirm]) btn.style.cssText='border:1px solid #64748b;border-radius:10px;padding:11px 16px;color:white;background:#334155;font-weight:600;cursor:pointer';
    confirm.style.background='#6d28d9';buttons.append(cancel,confirm);
    panel.append(heading,description,scroller,status,buttons);overlay.appendChild(panel);document.body.appendChild(overlay);
    const parseValue = str => {
      const v=String(str).replace(/R\$|\s/g,'');
      const normalized=v.includes(',')?v.replace(/\./g,'').replace(',','.'):v;
      return Number(normalized);
    };
    const fingerprint = i => [String(i.title||'').trim().toLowerCase().replace(/\s+/g,' '),i.date,Number(i.installmentValue).toFixed(2),Number(i.currentInstallment)||1,Number(i.installments)||1].join('|');
    // Correspondência exata preserva a regra original; semelhanças são apenas alertas.
    const normalizeName = s => String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
    const probableMatch = (item, existing) => existing.some(old => {
      const a=normalizeName(item.title), b=normalizeName(old.title);
      const valueClose=Math.abs(Number(old.installmentValue||0)-Number(item.installmentValue||0))<0.011;
      const sameInstallment=(Number(old.currentInstallment)||1)===(Number(item.currentInstallment)||1);
      return valueClose && sameInstallment && a.length>=3 && b.length>=3 && (a===b || a.includes(b) || b.includes(a));
    });
    const read = row => {
      const amount=parseValue(row.amount.value), total=parseValue(row.total.value);
      const current=Number(row.current.value), count=Number(row.installments.value);
      if(!row.title.value.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(row.date.value) || !Number.isFinite(amount) || amount<=0 || !Number.isFinite(total) || total<=0 || !Number.isInteger(current) || !Number.isInteger(count) || current<1 || count<1 || current>count) throw new Error('Confira descrição, data, valores positivos e parcelas (atual não pode superar o total).');
      return {...row.item,title:row.title.value.trim(),date:row.date.value,installmentValue:amount,currentInstallment:current,installments:count,isInstallment:count>1,totalAmount:total,category:inferCategoryFromTitle(row.title.value.trim())};
    };
    const update=()=>{
      const known=new Set(existingAtReview.map(fingerprint));
      let newCount=0, duplicateCount=0, reviewCount=0, sum=0, invalid=0, selected=0;
      const seenInPreview=new Set();
      controls.forEach(r=>{
        let item;
        try { item=read(r); }
        catch(_) { item=null; }
        const key=item ? fingerprint(item) : null;
        const exact=item && (known.has(key) || seenInPreview.has(key));
        if (item) seenInPreview.add(key);
        const similar=item && !exact && probableMatch(item,existingAtReview);
        if (r.initial) {
          if (exact) r.checked.checked=false;
          r.initial=false;
        }
        if (!item) {
          r.badge.textContent='Revisar';r.badge.style.background='#78350f';r.badge.style.color='#fde68a';
          r.tr.style.background='#451a1a';reviewCount++;
        } else if (exact) {
          r.badge.textContent='Duplicado';r.badge.style.background='#7f1d1d';r.badge.style.color='#fecaca';
          r.tr.style.background='rgba(127,29,29,.22)';duplicateCount++;
        } else if (similar) {
          r.badge.textContent='Revisar';r.badge.style.background='#78350f';r.badge.style.color='#fde68a';
          r.tr.style.background='rgba(120,53,15,.18)';reviewCount++;
        } else {
          r.badge.textContent='Novo';r.badge.style.background='#064e3b';r.badge.style.color='#a7f3d0';
          r.tr.style.background='';newCount++;
        }
        if (r.checked.checked) {
          selected++;
          if (!item) invalid++;
          else if (!exact) sum+=item.installmentValue;
        }
      });
      status.style.color='#93c5fd';
      status.textContent=`${newCount} novos • ${duplicateCount} duplicados • ${reviewCount} para revisar | ${selected} selecionados • ${formatBRL(sum)} a importar${invalid?' • '+invalid+' inválidos':''}`;
      confirm.disabled=!selected;
      confirm.style.opacity=confirm.disabled?'.5':'1';
      confirm.title=invalid ? `${invalid} linha(s) precisam de correção` : '';
    };
    controls.forEach(r=>[r.checked,r.date,r.title,r.amount,r.current,r.installments,r.total].forEach(el=>el.addEventListener('input',update)));
    const finish=()=>{overlay.remove();resolve();};
    cancel.addEventListener('click',finish);
    confirm.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (confirm.disabled) return;
      status.style.color='#93c5fd';
      status.textContent='Validando lançamentos selecionados...';
      const originalLabel=confirm.textContent;
      confirm.textContent='Importando...';
      confirm.disabled=true;
      try {
        const selected=controls.filter(r=>r.checked.checked);
        if (!selected.length) throw new Error('Selecione ao menos um lançamento.');
        const chosen=selected.map((r,index)=>{
          try { return read(r); }
          catch (err) {
            r.tr.style.background='#451a1a';
            r.tr.scrollIntoView({block:'center',behavior:'smooth'});
            throw new Error(`Linha ${controls.indexOf(r)+1}: ${err.message}`);
          }
        });
        const currentData=getCurrentMonthData();
        if (!currentData || typeof currentData !== 'object') throw new Error('Mês atual não encontrado.');
        const existing=Array.isArray(currentData.cardExpenses)?currentData.cardExpenses:[];
        const known=new Set(existing.map(fingerprint));
        const unique=chosen.filter(i=>{
          const key=fingerprint(i);
          if(known.has(key))return false;
          known.add(key);
          return true;
        });
        if (!unique.length) throw new Error('Todos os lançamentos selecionados já estão cadastrados.');
        const skipped=chosen.length-unique.length;
        const sum=unique.reduce((a,i)=>a+i.installmentValue,0);
        if (skipped && !window.confirm(`${skipped} duplicado(s) serão ignorados. Importar ${unique.length} lançamento(s)?`)) {
          status.textContent='Importação cancelada; nenhum lançamento foi salvo.';
          return;
        }
        if (typeof saveDatabase !== 'function') throw new Error('Função saveDatabase indisponível.');
        const previous=currentData.cardExpenses;
        currentData.cardExpenses=[...unique,...existing];
        try {
          saveDatabase();
        } catch (err) {
          currentData.cardExpenses=previous;
          throw new Error('Falha ao salvar os dados: '+(err.message||err));
        }
        overlay.remove();
        resolve();
        try { closeOcrModal(); } catch(e) { console.warn('Fechar modal:',e); }
        try { switchTab('card'); } catch(e) { console.warn('Mudar aba:',e); }
        try { renderAll(); } catch(e) { console.warn('Renderizar:',e); }
        showToast(`${unique.length} compras importadas (${formatBRL(sum)})!`,'success');
      } catch(err) {
        console.error('Falha na importação da revisão:',err);
        status.textContent='Erro: '+(err.message||String(err));
        status.style.color='#fca5a5';
        if (typeof showToast==='function') showToast('Confira a mensagem de erro abaixo da tabela.','error');
      } finally {
        confirm.textContent=originalLabel;
        if (overlay.isConnected) { confirm.disabled=false; confirm.style.opacity='1'; }
      }
    });
    update();
  });
}
