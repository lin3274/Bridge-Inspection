// ==UserScript==
// @name         人行橋系統填寫
// @namespace    http://tampermonkey.net/
// @version      3.9
// @description  自動抓取 PBMIS 系統欄位並反填。純 ID 抓取、防呆比對、U值連動、跨頁面智慧日期記憶。
// @author       You
// @match        *://pbmis.nlma.gov.tw/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/lin3274/Bridge-Inspection/refs/heads/main/人行橋系統填寫.user.js
// @updateURL    https://raw.githubusercontent.com/lin3274/Bridge-Inspection/refs/heads/main/人行橋系統填寫.user.js
// @license     MIT
// ==/UserScript==
console.log('🚀 [PBMIS] 腳本v3.9載入');
(function() {
    'use strict';

    // 純 ID 抓取
    const CONFIG = {
        componentName: '#cmpl_no',       // 構件名稱 (下拉選單)
        defectObject:  '#ddlTD_DRF',     // 劣化物件 (下拉選單)
        defectType:    '#ddlTD_DRT',     // 劣化類型 (下拉選單)
        defectstatus:  '#ddlTD_DRS',     // 劣化狀況 (下拉選單)
        valD:          '#IN_D',          // 檢測D值
        valE:          '#IN_E',          // 檢測E值
        valR:          '#IN_R',          // 檢測R值
        valU:          '#IN_U',          // 檢測U值
        quantity:      '#BEFORE_QTY',    // 數量(檢測)
        unit:          '#FACILITY_UNIT', // 單位(檢測) (下拉選單)
        targetDesc:    '#DAMAGE_NOTE',   // 損害說明 (文字區塊)
        date:          '#INSPECTION_TIME'// 填寫日期
    };

    const OBJ_KEYWORDS = [
        '主梁', '橫桿', '橫隔梁', '斜撐', '橋台', '翼牆', '擋土牆', '橋墩', '帽梁',
        '立柱', '橋面板', '護欄', '支承', '阻尼', '防落', '伸縮縫', '引道', '路堤',
        '河道', '排水', '照明', '雨遮', '鋪面', '橋塔', '鋼纜', '吊索', '拱肋', '拱圈'
    ];

    // 特殊劣化類型白名單 (映射字典)
    // 格式：'觸發關鍵字': '強制對應的選單項目文字'
    const DEFECT_TYPE_WHITELIST = {
        '非結構性裂縫': '其他',
        '材料、乾縮裂縫等': '其他'
        // 你可以繼續在這裡新增，例如：
        // '鳥糞': '其他',
        // '不明污漬': '表面污染'
    };

    const delay = (ms) => new Promise(res => setTimeout(res, ms));

// 1. 增強版字串清理器：無視全半形、括號、斜線與異體字
    function normalizeText(text) {
        if (!text) return '';
        return text
            .toLowerCase()                     // 轉小寫
            .replace(/[\s]+/g, '')             // 去除所有空白
            .replace(/[（）()【】\[\]]/g, '')    // 移除所有種類的括號
            .replace(/樑/g, '梁')              // 統一異體字：樑 -> 梁
            .replace(/臺/g, '台')              // 統一異體字：臺 -> 台
            .replace(/[、/\\_,-]/g, '');       // 移除斜線、頓號等干擾符號
    }

    function getSelectText(selector) {
        const el = document.querySelector(selector);
        if (!el) return '';
        return (el.tagName.toLowerCase() === 'select' && el.selectedIndex >= 0) ?
        el.options[el.selectedIndex].text.trim() : '';
    }

    function setInputValue(selector, value) {
        const el = document.querySelector(selector);
        if (!el) {
            console.warn(`⚠️ [警告] 找不到輸入框: ${selector}`);
            return;
        }
        el.value = value;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
    }

// 2. 雙向包含最佳權重比對演算法
    function setSelectByText(selector, textToMatch) {
        const el = document.querySelector(selector);
        if (!el || !textToMatch) {
            if(!el) console.warn(`⚠️ [警告] 找不到下拉選單: ${selector}`);
            return;
        }

        const normalizedTarget = normalizeText(textToMatch);
        let bestIndex = -1;
        let maxLength = 0;

        for (let i = 0; i < el.options.length; i++) {
            const normalizedOption = normalizeText(el.options[i].text);
            if (!normalizedOption) continue;

            // 1. 完全相等：最高優先級，直接採用
            if (normalizedTarget === normalizedOption) {
                bestIndex = i;
                break;
            }

            // 2. 雙向包含：目標包含選項 或 選項包含目標
            if (normalizedTarget.includes(normalizedOption) || normalizedOption.includes(normalizedTarget)) {
                // 權重機制：選擇字串最長的選項
                if (normalizedOption.length > maxLength) {
                    maxLength = normalizedOption.length;
                    bestIndex = i;
                }
            }
        }

        // 執行選取與連動更新
        if (bestIndex !== -1) {
            el.selectedIndex = bestIndex;
            el.dispatchEvent(new Event('change', { bubbles: true }));
            if (window.jQuery && window.jQuery(el).hasClass('selectpicker')) {
                window.jQuery(el).selectpicker('refresh');
            }
            console.log(`🎯 [PBMIS] 成功匹配下拉選單：${el.options[bestIndex].text}`);
        } else {
            console.warn(`⚠️ [PBMIS] 無法在選單中找到任何相符的項目: ${textToMatch}`);
        }
    }

    async function waitForOptions(selector, timeout = 5000) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeout) {
            const el = document.querySelector(selector);
            if (el && el.options && el.options.length > 1) {
                return Array.from(el.options).filter(opt => opt.value && !opt.text.includes('選擇'));
            }
            await delay(300);
        }
        return [];
    }

    function getExpandedKeywords(str) {
        let words = str.split(/[、,， /_+-]+/);
        let expanded = new Set(words);
        expanded.add(str);

        const rules = [
            { match: ['鏽', '銹', '腐蝕'], add: ['銹', '鏽', '生銹', '腐蝕'] },
            { match: ['裂'], add: ['裂縫', '龜裂', '破裂'] },
            { match: ['剝'], add: ['剝落', '剝脫'] },
            { match: ['變形'], add: ['變形', '歪斜'] },
            { match: ['塗裝'], add: ['塗裝', '油漆'] }
        ];

        words.forEach(w => {
            rules.forEach(rule => {
                if (rule.match.some(m => normalizeText(w).includes(normalizeText(m)))) {
                    rule.add.forEach(a => expanded.add(a));
                }
            });
        });
        return Array.from(expanded).filter(Boolean);
    }

// =====================================================================
    // 第二階段：動態生成「劣化類型」快捷按鈕 (加入白名單機制)
    // =====================================================================
    async function injectDefectTypeButtons(targetDefectTypeStr, targetDeru = null) {
        const container = document.getElementById('pbmis-helper-btns');
        if (!container) return;

        container.innerHTML = '<span style="color: #17a2b8; font-weight: bold;">⏳ 載入劣化類型中，請稍候...</span>';

        const validOptions = await waitForOptions(CONFIG.defectType, 5000);
        if (validOptions.length === 0) {
            container.innerHTML = '<span style="color: #d9534f; font-weight: bold;">⚠️ 無法載入劣化類型選項。</span>';
            setTimeout(() => { if(container) container.remove(); }, 3000);
            return;
        }

        let filteredOptions = [];
        let isWhitelistTriggered = false;
        let overrideOptionText = '';

        // 🌟 1. 優先檢查白名單
        for (const [key, targetOption] of Object.entries(DEFECT_TYPE_WHITELIST)) {
            if (targetDefectTypeStr.includes(key)) {
                isWhitelistTriggered = true;
                overrideOptionText = targetOption;
                break; // 命中一個就跳出
            }
        }

        // 🌟 2. 決定過濾邏輯
        if (isWhitelistTriggered) {
            // 如果命中白名單，強制只抓取指定的選項 (例如「其他」)
            filteredOptions = validOptions.filter(opt =>
                normalizeText(opt.text).includes(normalizeText(overrideOptionText))
            );
            container.innerHTML = filteredOptions.length > 0
                ? `<span style="color: #6f42c1; font-weight: bold;">🌟 觸發白名單 (${targetDefectTypeStr} ➡️ ${overrideOptionText})：</span>`
                : `<span style="color: #d9534f; font-weight: bold;">⚠️ 白名單指定為「${overrideOptionText}」，但選單中找不到該項目！</span>`;
        } else {
            // 原本的模糊比對邏輯
            let keywords = getExpandedKeywords(targetDefectTypeStr);
            filteredOptions = validOptions.filter(opt =>
                keywords.some(kw => normalizeText(opt.text).includes(normalizeText(kw)) || normalizeText(kw).includes(normalizeText(opt.text)))
            );

            container.innerHTML = filteredOptions.length > 0
                ? `<span style="color: #007bff; font-weight: bold;">🎯 已為您篩選相關類型 (${targetDefectTypeStr})：</span>`
                : `<span style="color: #d9534f; font-weight: bold;">👉 未找到完全匹配的類型，請手動選擇：</span>`;
        }

        let displayOptions = filteredOptions.length > 0 ? filteredOptions : validOptions;

        // 🌟 3. 生成按鈕
        displayOptions.forEach(opt => {
            const btn = document.createElement('button');
            btn.innerText = opt.text;
            btn.style.cssText = `
                padding: 6px 12px; font-size: 13px; background-color: #6c757d;
                color: white; border: none; border-radius: 4px; cursor: pointer; transition: 0.2s;
            `;
            // 若為白名單強制選項，按鈕換成紫色系凸顯
            if (isWhitelistTriggered && filteredOptions.includes(opt)) {
                btn.style.backgroundColor = '#6f42c1';
                btn.onmouseover = () => btn.style.backgroundColor = '#59339d';
                btn.onmouseout = () => btn.style.backgroundColor = '#6f42c1';
            } else {
                btn.onmouseover = () => btn.style.backgroundColor = '#5a6268';
                btn.onmouseout = () => btn.style.backgroundColor = '#6c757d';
            }

            btn.onclick = async (e) => {
                e.preventDefault();

                const statusSelect = document.querySelector(CONFIG.defectstatus);
                if (statusSelect) {
                    statusSelect.innerHTML = '<option value="">請選擇</option>';
                    if (window.jQuery && window.jQuery(statusSelect).hasClass('selectpicker')) {
                        window.jQuery(statusSelect).selectpicker('refresh');
                    }
                }

                setSelectByText(CONFIG.defectType, opt.text);

                if (targetDeru && targetDeru.length >= 4) {
                    const uValueStr = targetDeru[3];
                    const uValueNum = parseInt(uValueStr, 10);
                    let targetStatus = '';

                    // 🔍 判斷目前選擇的「劣化類型」是否為「其他」
                    const isOtherType = opt.text.includes('其他損傷');

                    if (isOtherType) {
                        // 🌟 狀況 A：劣化類型為「其他」 (新邏輯)
                        if (!isNaN(uValueNum)) {
                            if (uValueNum <= 2) {
                                targetStatus = '不影響橋上行人及橋下人車安全的損傷劣化';
                            } else {
                                targetStatus = '影響橋上行人及橋下人車安全或造成使用障礙';
                            }
                        }
                    } else {
                        // 🌟 狀況 B：一般劣化類型 (舊邏輯)
                        if (uValueStr === '1') targetStatus = '輕微';
                        else if (uValueStr === '2') targetStatus = '明顯';
                        else if (uValueStr === '3') targetStatus = '嚴重';
                        else if (uValueStr === '4') targetStatus = '極嚴重';
                    }

                    // 執行下拉選單等待與連動
                    if (targetStatus) {
                        const typeLabel = isOtherType ? '其他項目' : '一般項目';
                        container.innerHTML = `<span style="color: #17a2b8; font-weight: bold;">⏳ 載入劣化狀況中... (${typeLabel}, U=${uValueStr})</span>`;

                        await waitForOptions(CONFIG.defectstatus, 5000);

                        setSelectByText(CONFIG.defectstatus, targetStatus);
                        console.log(`✅ [PBMIS] 已根據 U=${uValueStr} (${typeLabel}) 選擇劣化狀況: ${targetStatus}`);
                    }

                    console.log(`🔢 [PBMIS] 準備填入 DERU: ${targetDeru}`);
                    setInputValue(CONFIG.valD, targetDeru[0]);
                    setInputValue(CONFIG.valE, targetDeru[1]);
                    setInputValue(CONFIG.valR, targetDeru[2]);
                    setInputValue(CONFIG.valU, targetDeru[3]);
                }

                container.innerHTML = '<span style="color: #28a745; font-weight: bold;">✅ 流程填寫完成！</span>';
                setTimeout(() => { if(container) container.remove(); }, 2000);
            };
            container.appendChild(btn);
        });
    }

    // =====================================================================
    // 第一階段：動態生成「劣化物件」快捷按鈕
    // =====================================================================
    async function injectObjectButtons(targetDefectType = null, filterCompName = '', targetDeru = null) {
        console.log('🔄 [PBMIS] 準備載入「劣化物件」連動選單...');
        const objSelect = document.querySelector(CONFIG.defectObject);
        if (!objSelect) {
            console.warn('⚠️ 找不到劣化物件下拉選單:', CONFIG.defectObject);
            return;
        }

        await delay(800);

        const containerId = 'pbmis-helper-btns';
        let container = document.getElementById(containerId);
        if (container) container.remove();

        container = document.createElement('div');
        container.id = containerId;
        container.style.cssText = `
            margin-top: 8px;
            padding: 10px; background: #f8f9fa;
            border: 1px dashed #adb5bd; border-radius: 6px;
            display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
        `;
        const wrapper = objSelect.closest('.bootstrap-select') || objSelect;
        wrapper.parentNode.insertBefore(container, wrapper.nextSibling);

        let titleHtml = '<span style="color: #d9534f; font-size: 14px; font-weight: bold;">👉 請點擊物件以繼續：</span>';
        let validOptions = Array.from(objSelect.options).filter(opt => opt.value && !opt.text.includes('選擇'));

        if (filterCompName) {
            let matchedKeywords = OBJ_KEYWORDS.filter(kw => normalizeText(filterCompName).includes(normalizeText(kw)));
            if (matchedKeywords.length > 0) {
                const filteredOptions = validOptions.filter(opt =>
                    matchedKeywords.some(kw => normalizeText(opt.text).includes(normalizeText(kw)))
                );
                if (filteredOptions.length > 0) {
                    validOptions = filteredOptions;
                    titleHtml = `<span style="color: #007bff; font-size: 14px; font-weight: bold;">🎯 已篩選相關物件 (${matchedKeywords.join(', ')})：</span>`;
                }
            }
        }

        container.innerHTML = titleHtml;

        if (validOptions.length === 0) {
            container.innerHTML += '<span style="font-size: 13px; color: #666;">無可用物件</span>';
            setTimeout(() => { if(container) container.remove(); }, 3000);
            return;
        }

        validOptions.forEach(opt => {
            const btn = document.createElement('button');
            btn.innerText = opt.text;
            btn.style.cssText = `
                padding: 6px 12px; font-size: 13px; background-color: #6c757d;
                color: white; border: none; border-radius: 4px; cursor: pointer; transition: 0.2s;
            `;
            btn.onmouseover = () => btn.style.backgroundColor = '#5a6268';
            btn.onmouseout = () => btn.style.backgroundColor = '#6c757d';

            btn.onclick = async (e) => {
                e.preventDefault();

                const typeSelect = document.querySelector(CONFIG.defectType);
                if (typeSelect) {
                    typeSelect.innerHTML = '<option value="">請選擇</option>';
                    if (window.jQuery && window.jQuery(typeSelect).hasClass('selectpicker')) {
                        window.jQuery(typeSelect).selectpicker('refresh');
                    }
                }

                setSelectByText(CONFIG.defectObject, opt.text);

                if (targetDefectType) {
                    injectDefectTypeButtons(targetDefectType, targetDeru);
                } else {
                    container.innerHTML = '<span style="color: #28a745; font-weight: bold;">✅ 已選擇！</span>';
                    setTimeout(() => { if(container) container.remove(); }, 1500);
                }
            };
            container.appendChild(btn);
        });
    }

    // =====================================================================
    // 功能：反向填寫核心
    // =====================================================================
    function reverseFill(btnElement) {
        console.log('====================================');
        console.log('🔵 [PBMIS] 啟動反向填寫 (說明 -> 欄位)');
        try {
            const targetEl = document.querySelector(CONFIG.targetDesc);
            if (!targetEl || !targetEl.value) {
                alert('請先在「損害說明」框內貼上文字！');
                return;
            }

            const text = targetEl.value.trim();
            const parts = text.split('-');
            if (parts.length < 4) {
                alert('格式解析失敗！請確認文字是否正確。');
                return;
            }

            // 📅 處理填寫日期 (跨頁面記憶邏輯)
            const dateEl = document.querySelector(CONFIG.date);
            if (dateEl) {
                // 從暫存區讀取日期
                let memDate = sessionStorage.getItem('PBMIS_SAVED_DATE');

                if (!memDate) {
                    // 如果沒有暫存，就抓今天的日期
                    const now = new Date();
                    const y = now.getFullYear();
                    const m = String(now.getMonth() + 1).padStart(2, '0');
                    const d = String(now.getDate()).padStart(2, '0');
                    memDate = `${y}-${m}-${d}`;
                    sessionStorage.setItem('PBMIS_SAVED_DATE', memDate);
                }

                // 將記憶或今天的日期填入
                setInputValue(CONFIG.date, memDate);
                console.log(`📅 [PBMIS] 已填入日期: ${memDate}`);
            }

            const qtyUnitStr = parts.pop().trim();
            const deru = parts.pop().trim();
            const defType = parts.pop().trim();
            const compName = parts.join('-').trim();

            const numberMatch = qtyUnitStr.match(/[0-9.]+/);
            const qty = numberMatch ? numberMatch[0] : '';
            const unit = qtyUnitStr.replace(/[0-9.]+/g, '').trim();

            setInputValue(CONFIG.quantity, qty);
            setSelectByText(CONFIG.unit, unit);
            setSelectByText(CONFIG.componentName, compName);

            injectObjectButtons(defType, compName, deru);

            const originalText = btnElement.innerText;
            btnElement.innerText = '✅ 反填啟動 (請點擊物件)';
            btnElement.style.backgroundColor = '#138496';
            setTimeout(() => {
                btnElement.innerText = originalText;
                btnElement.style.backgroundColor = '#17a2b8';
            }, 2000);
        } catch (error) {
            console.error('❌ [PBMIS 嚴重錯誤] 反向填寫發生例外狀況:', error);
            alert('解析或填寫時發生錯誤，請檢查 Console。');
        }
    }

    // =====================================================================
    // 建立浮動按鈕與事件監聽
    // =====================================================================
    function initTools() {
        if (document.getElementById('pbmis-tools-container')) return;

        const container = document.createElement('div');
        container.id = 'pbmis-tools-container';
        container.style.cssText = `
            position: fixed; bottom: 30px; right: 30px;
            z-index: 99999;
            display: flex; flex-direction: column; gap: 10px;
        `;

        const btnStyle = `
            padding: 12px 20px;
            color: white; border: none; border-radius: 8px;
            font-size: 15px; font-weight: bold; cursor: pointer;
            box-shadow: 0 4px 8px rgba(0,0,0,0.2);
            transition: 0.2s, transform 0.1s;
        `;

        const btnRev = document.createElement('button');
        btnRev.innerText = '🔄 反填所有欄位';
        btnRev.style.cssText = btnStyle + 'background-color: #17a2b8;';
        btnRev.onmouseover = () => { btnRev.style.backgroundColor = '#138496'; };
        btnRev.onmouseout = () => { btnRev.style.backgroundColor = '#17a2b8'; };
        btnRev.onmousedown = () => { btnRev.style.transform = 'scale(0.95)'; };
        btnRev.onmouseup = () => { btnRev.style.transform = 'scale(1)'; };
        btnRev.onclick = (e) => { e.preventDefault(); reverseFill(btnRev); };

        container.appendChild(btnRev);
        document.body.appendChild(container);

        // 監聽手動切換構件名稱
        const compSelectEl = document.querySelector(CONFIG.componentName);
        if (compSelectEl) {
            compSelectEl.addEventListener('change', (e) => {
                if (!e.isTrusted) return;
                const currentCompName = getSelectText(CONFIG.componentName);
                injectObjectButtons(null, currentCompName);
            });
        }

        // ❗新增：全方位綁定日期修改監聽❗
        const dateEl = document.querySelector(CONFIG.date);
        if (dateEl) {
            const saveDateMemory = () => {
                const val = dateEl.value.trim();
                // 如果日期有值，且跟目前暫存的不同，就更新暫存
                if (val && sessionStorage.getItem('PBMIS_SAVED_DATE') !== val) {
                    sessionStorage.setItem('PBMIS_SAVED_DATE', val);
                    console.log(`📅 [PBMIS] 已自動記憶你修改的日期: ${val}`);
                }
            };

            // 監聽各種失去焦點與修改事件
            dateEl.addEventListener('change', saveDateMemory);
            dateEl.addEventListener('blur', saveDateMemory);
            dateEl.addEventListener('focusout', saveDateMemory);

            // 針對網頁如果有使用 jQuery 日曆套件的特殊攔截
            if (window.jQuery) {
                window.jQuery(CONFIG.date).on('change changeDate hide', saveDateMemory);
            }
        }

        console.log('✅ [PBMIS] UI 建立完成！');
    }

    const initInterval = setInterval(() => {
        if (document.body && document.querySelector(CONFIG.componentName)) {
            initTools();
            clearInterval(initInterval);
        }
    }, 1000);
})();
