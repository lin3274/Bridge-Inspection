// ==UserScript==
// @name         橋梁系統自動填寫與計算經費_北分箱內版
// @namespace    http://tampermonkey.net/
// @version      0.9.6
// @description  自動更新規則、自動填寫單位、新增構件專屬備註快捷鍵
// @match        *://thbpbms.thb.gov.tw/*
// @run-at       document-idle
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/lin3274/Bridge-Inspection/refs/heads/main/橋梁系統自動填寫與計算經費_北分箱內版.user.js?
// @updateURL    https://raw.githubusercontent.com/lin3274/Bridge-Inspection/refs/heads/main/橋梁系統自動填寫與計算經費_北分箱內版.user.js?
// @license     MIT
// ==/UserScript==

(function() {
    'use strict';

    console.log('[橋梁外掛] ⏳ 腳本 v0.9.6 已載入。');

    // 🌟 選擇器常數化
    const SELECTORS = {
        COMP: '#boxinsp_comp', // 構件欄位 (Select)
        DEFECT: '#deterioration', // 劣化類型 (Select)
        DEFECT_TEXT: '#deterioration_text', // 假設存在的劣化文字欄位 (Input)
        METHOD: '#method', // 維修工法 (Input)
        REMARK: '#remark', // 備註 (Textarea)
        QTY: '#amount', // 數量 (Input)
        UNIT: '#unit', // 單位 (Select)
        COST: '#total' // 經費 (Input)
    };

    const RULES = [
        { defect: '混凝土裂縫', groups: ['混凝土裂縫', '非裂'], keyword: '非裂', method: '塗抹環氧樹脂修復(裂縫寬度＜0.3mm)', price: 800, autoRemark: '劣化類型:非結構性裂縫（材料、乾縮裂縫等）裂縫寬度<0.3mm', unit: '平方公尺' },
        { defect: '混凝土裂縫', groups: ['混凝土裂縫', '非裂(>0.3mm)'], keyword: '非裂(>0.3mm)', method: '環氧樹脂裂縫灌注(裂縫寬度≧0.3mm)', price: 1500, autoRemark: '劣化類型:結構性裂縫，裂縫寬度>0.3mm', unit: '公尺' },
        { defect: '混凝土蜂窩或剝落破損', groups: ['混凝土蜂窩或剝落破損', '剝落', '混剝'], keyword: '混剝', method: '混凝土修復', price: 2500, autoRemark: '', unit: '平方公尺' },
        { defect: '鋼筋裸露且銹蝕', groups: ['鋼筋裸露且銹蝕', '鋼筋外露', '鋼露'], keyword: '鋼露', method: '鋼筋除鏽及混凝土修復', price: 4500, autoRemark: '', unit: '平方公尺' },
        { defect: '混凝土蜂窩或剝落破損', groups: ['混凝土蜂窩或剝落破損', '蜂窩', '混蜂'], keyword: '混蜂', method: '表面蜂窩修補', price: 2500, autoRemark: '', unit: '平方公尺' },
        { defect: '滲水、白華', groups: ['滲水、白華', '白華'], keyword: '白華', method: '白華處理', price: 3000, autoRemark: '', unit: '平方公尺' },
        { defect: '滲水、白華且有銹水流出', groups: ['滲水、白華且有銹水流出', '銹水', '滲水白華'], keyword: '滲水白華', method: '滲水白華裂縫處理', price: 3500, autoRemark: '', unit: '平方公尺' },
        { defect: '其他', groups: ['其他', '水痕'], keyword: '水痕', method: '持續觀察', price: 0, autoRemark: '劣化類型:水痕', unit: '式' },
        { defect: '積土或雜物堆積', groups: ['積土或雜物堆積', '清雜'], keyword: '清雜', method: '清除雜物', price: 2000, autoRemark: '', unit: '處' },
        { defect: '模板未拆除', groups: ['模板未拆除', '模板'], keyword: '模板', method: '清除雜物', price: 500, autoRemark: '', unit: '處' },
        { defect: '模板未拆除', groups: ['模板未拆除', '模板(大)'], keyword: '模板(大)', method: '清除雜物', price: 2000, autoRemark: '', unit: '處' },
        { defect: '其他', groups: ['其他', '鋼凸'], keyword: '鋼凸', method: '鋼筋凸出切除', price: 300, autoRemark: '劣化類型:鋼筋凸出', unit: '處' },
        { defect: '寄居生物巢穴、排泄物', groups: ['寄居生物巢穴、排泄物', '巢穴'], keyword: '巢穴', method: '清除雜物', price: 2000, autoRemark: '', unit: '處' },
        { defect: '漏水', groups: ['漏水'], keyword: '漏水', method: 'PVC排水管止漏', price: 1000, autoRemark: '', unit: '處' },
        { defect: '積水或洩水孔堵塞', groups: ['積水或洩水孔堵塞', '積水'], keyword: '積水', method: '管線修復、抽排水', price: 6000, autoRemark: '', unit: '工' },
        { defect: '螺栓損傷、欠缺及鬆動', groups: ['螺栓損傷、欠缺及鬆動', '螺栓'], keyword: '螺栓', method: '螺栓補鎖', price: 200, autoRemark: '', unit: '個' }
    ];

    // 建立關鍵字索引字典 (Set 去重)
    const KEYWORD_MAP = new Map();
    RULES.forEach(r => {
        KEYWORD_MAP.set(r.defect, r.defect);
        KEYWORD_MAP.set(r.keyword, r.defect);
        r.groups.forEach(g => KEYWORD_MAP.set(g, r.defect));
    });

    // 依長度排序，確保優先比對長字串 (例如 "模板(大)" 優先於 "模板")
    const ALL_KEYWORDS = Array.from(KEYWORD_MAP.entries())
        .map(([searchStr, defectName]) => ({ searchStr, defectName }))
        .sort((a, b) => b.searchStr.length - a.searchStr.length);

    let inputTimeout = null;
    let isUpdating = false;

    // 取得選單或輸入框的真實文字值
    function getElementTextValue(el) {
        if (!el) return "";
        return el.tagName === 'SELECT' ? (el.selectedIndex >= 0 ? el.options[el.selectedIndex].text : '') : el.value;
    }

    // 更新構件專屬按鈕
    function updateCompButtons(compText) {
        let remarkEl = document.querySelector(SELECTORS.REMARK);
        if (!remarkEl) return;

        let oldContainer = document.querySelector('.tm-comp-btn-container');
        if (oldContainer) oldContainer.remove();

        let btns = [];
        if (compText.includes('端隔梁')) btns = ['劣化構件:橋尾側端隔梁', '劣化構件:橋頭側端隔梁'];
        else if (compText.includes('隔板(橫隔梁)')) btns = ['劣化構件:橋尾側隔板', '劣化構件:橋頭側隔板'];
        else if (compText.includes('其他')) btns = ['劣化構件:支承剪力裝置'];

        if (btns.length === 0) return;

        let btnContainer = document.createElement('div');
        btnContainer.className = 'tm-comp-btn-container';
        btnContainer.style.cssText = 'margin-top: 8px; margin-bottom: 8px;';

        btns.forEach(btnText => {
            let btn = document.createElement('button');
            btn.textContent = btnText;
            btn.style.cssText = 'margin-right: 8px; padding: 4px 10px; cursor: pointer; font-size: 13px; background: #17a2b8; color: white; border: none; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.2); transition: 0.2s;';
            btn.onmouseover = () => btn.style.background = '#138496';
            btn.onmouseout = () => btn.style.background = '#17a2b8';

            btn.onclick = (e) => {
                e.preventDefault();
                if (isUpdating) return;
                isUpdating = true;

                let currentRemark = remarkEl.value;
                btns.forEach(b => {
                    currentRemark = currentRemark.replace(b, '').replace(/^\s*[\r\n]/gm, '').trim();
                });

                remarkEl.value = currentRemark ? btnText + '\n' + currentRemark : btnText;
                remarkEl.dispatchEvent(new Event('change', { bubbles: true }));
                setTimeout(() => { isUpdating = false; }, 50);
            };
            btnContainer.appendChild(btn);
        });

        remarkEl.parentNode.insertBefore(btnContainer, remarkEl.nextSibling);
    }

    // 計算總價
    function calculateCost() {
        let amountEl = document.querySelector(SELECTORS.QTY);
        let methodEl = document.querySelector(SELECTORS.METHOD);
        let totalEl = document.querySelector(SELECTORS.COST);
        // 這裡不需要從下拉選單取劣化文字，因為計價主要看工法 (method) 欄位
        
        if (!amountEl || !methodEl || !totalEl) return;

        let qty = parseFloat(amountEl.value);
        let methodText = methodEl.value;
        let currentPrice = -1;

        // 1. 絕對優先：完全精確比對 (完全等於才算)
        let exactMatchedRule = RULES.find(r => r.method === methodText);
        
        if (exactMatchedRule) {
            currentPrice = exactMatchedRule.price;
        } else {
            // 2. 模糊比對：尋找包含的字串，但強制取「字串長度最長」的規則，避免子字串誤判
            let maxLen = 0;
            RULES.forEach(rule => {
                let pureMethod = rule.method.replace(/\(.*\)/, '');
                // 檢查 methodText 是否包含規則字眼
                if ((methodText.includes(rule.method) || methodText.includes(pureMethod)) && rule.method.length > maxLen) {
                    currentPrice = rule.price;
                    maxLen = rule.method.length;
                }
            });
        }

        // 3. 計算並填寫總價
        if (currentPrice >= 0 && !isNaN(qty)) {
            let totalCost = qty * currentPrice;
            if (parseFloat(totalEl.value) !== totalCost || totalEl.value === "") {
                totalEl.value = totalCost;
                totalEl.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
    }

    // 處理工法快捷鍵按鈕
    function createShortcutButtons(targetInput, matchedRules) {
        let ruleKeys = matchedRules.map(r => r.keyword).join('|');
        let oldContainer = document.querySelector('.tm-btn-container');

        if (oldContainer) {
            if (oldContainer.dataset.rules === ruleKeys) return;
            oldContainer.remove();
        }

        let btnContainer = document.createElement('span');
        btnContainer.className = 'tm-btn-container';
        btnContainer.dataset.rules = ruleKeys;
        btnContainer.style.marginLeft = '10px';

        matchedRules.forEach(rule => {
            let btn = document.createElement('button');
            btn.textContent = rule.keyword;
            btn.title = rule.method;
            btn.style.cssText = 'margin-right: 5px; padding: 3px 8px; cursor: pointer; font-size: 13px; background: #007BFF; color: white; border: none; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.2); transition: 0.2s;';
            btn.onmouseover = () => { if (btn.style.background !== 'rgb(40, 167, 69)') btn.style.background = '#0056b3'; };
            btn.onmouseout = () => { if (btn.style.background !== 'rgb(40, 167, 69)') btn.style.background = '#007BFF'; };

            btn.onclick = (e) => {
                e.preventDefault();
                fillMethod(targetInput, rule);
                Array.from(btnContainer.children).forEach(b => b.style.background = '#007BFF');
                btn.style.background = '#28A745';
            };
            btnContainer.appendChild(btn);
        });

        targetInput.parentNode.insertBefore(btnContainer, targetInput.nextSibling);
    }

    // 填入規則資料 (工法、備註、單位)
    function fillMethod(methodEl, rule) {
        if (!rule) return;
        isUpdating = true;

        // 1. 填入工法
        if (methodEl.value !== rule.method) {
            methodEl.value = rule.method;
            methodEl.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // 2. 填入備註 (優化：切換時自動清理舊的自動備註)
        let remarkEl = document.querySelector(SELECTORS.REMARK);
        if (remarkEl) {
            let currentVal = remarkEl.value;

            // 先清除所有 RULES 中定義過的 autoRemark，避免疊加
            RULES.forEach(r => {
                if (r.autoRemark && currentVal.includes(r.autoRemark)) {
                    currentVal = currentVal.replace(r.autoRemark, '');
                }
            });

            // 清理多餘的空白行與首尾空白
            currentVal = currentVal.replace(/^\s*[\r\n]/gm, '').trim();

            // 如果目前選取的規則有專屬 autoRemark，則加到最下方
            if (rule.autoRemark) {
                currentVal = currentVal ? currentVal + '\n' + rule.autoRemark : rule.autoRemark;
            }

            // 如果內容有變動，才重新賦值並觸發事件
            if (remarkEl.value !== currentVal) {
                remarkEl.value = currentVal;
                remarkEl.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }

        // 3. 填入單位
        if (rule.unit) {
            let unitEl = document.querySelector(SELECTORS.UNIT);
            if (unitEl) {
                if (unitEl.tagName === 'SELECT') {
                    let targetOption = Array.from(unitEl.options).find(opt => opt.text === rule.unit || opt.value === rule.unit);
                    if (targetOption && unitEl.value !== targetOption.value) {
                        unitEl.value = targetOption.value;
                        unitEl.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                } else if (unitEl.value !== rule.unit) {
                    unitEl.value = rule.unit;
                    unitEl.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        }

        calculateCost();
        setTimeout(() => { isUpdating = false; }, 50);
    }

    // 主邏輯分配器
    function processAllLogic(targetEl) {
        if (isUpdating) return;

        // 1. 處理構件變更 (產生方向備註按鈕)
        if (targetEl.matches(SELECTORS.COMP)) {
            updateCompButtons(getElementTextValue(targetEl));
        }

        // 2. 處理劣化類型變更 (推薦工法按鈕)
        if (targetEl.matches(SELECTORS.DEFECT) || targetEl.matches(SELECTORS.DEFECT_TEXT)) {
            let defectText = getElementTextValue(targetEl);
            if (defectText) {
                let matchedRules = RULES.filter(rule =>
                    defectText.includes(rule.defect) || defectText.includes(rule.keyword) || rule.groups.some(g => defectText.includes(g))
                );

                let methodEl = document.querySelector(SELECTORS.METHOD);
                if (methodEl) {
                    if (matchedRules.length === 1) {
                        let oldContainer = document.querySelector('.tm-btn-container');
                        if (oldContainer) oldContainer.remove();
                        fillMethod(methodEl, matchedRules[0]);
                    } else if (matchedRules.length > 1) {
                        createShortcutButtons(methodEl, matchedRules);
                    } else {
                        let oldContainer = document.querySelector('.tm-btn-container');
                        if (oldContainer) oldContainer.remove();
                    }
                }
            }
        }

        // 3. 處理數量與工法變更 (重新計算經費)
        if (targetEl.matches(SELECTORS.QTY) || targetEl.matches(SELECTORS.METHOD)) {
            calculateCost();
        }
    }

    // 初始化事件監聽
    function initScript() {
        function handleEvent(e) {
            let target = e.target;
            if (!target || typeof target.matches !== 'function') return;

            // 確認目標是否在監聽範圍內
            const isTargetField = Object.values(SELECTORS).some(selector => target.matches(selector));
            if (!isTargetField) return;

            clearTimeout(inputTimeout);
            inputTimeout = setTimeout(() => processAllLogic(target), 300);
        }

        // 使用 Event Delegation，統一在 body 攔截事件，取代原本的 setInterval 掃描
        document.body.addEventListener('input', handleEvent);
        document.body.addEventListener('change', handleEvent);

        // 初始載入時，若已有預設值則先觸發一次按鈕生成
        let compEl = document.querySelector(SELECTORS.COMP);
        if (compEl && getElementTextValue(compEl)) {
            updateCompButtons(getElementTextValue(compEl));
        }
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        initScript();
    } else {
        window.addEventListener('DOMContentLoaded', initScript);
    }

})();
