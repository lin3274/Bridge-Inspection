// ==UserScript==
// @name         橋梁系統自動填寫與計算經費_北分箱內版
// @namespace    http://tampermonkey.net/
// @version      0.9.13
// @description  Enterprise-Optimized: 修復手動輸入工法遭覆寫的問題，強化備註正則清理，全面提升健壯性
// @match        *://thbpbms.thb.gov.tw/*
// @run-at       document-idle
// @grant        none
// @downloadURL  https://raw.githubusercontent.com/lin3274/Bridge-Inspection/refs/heads/main/橋梁系統自動填寫與計算經費_北分箱內版.user.js
// @updateURL    https://raw.githubusercontent.com/lin3274/Bridge-Inspection/refs/heads/main/橋梁系統自動填寫與計算經費_北分箱內版.user.js
// @license     MIT
// ==/UserScript==

(function() {
    'use strict';

    console.log('[橋梁外掛] ⏳ 腳本 v0.9.13 已載入。');

    // ==========================================
    // 1. 常數與設定區 (Constants & Config)
    // ==========================================
    const SELECTORS = {
        COMP: '#boxinsp_comp',
        DEFECT: '#deterioration',
        DEFECT_TEXT: '#deterioration_text',
        METHOD: '#method',
        REMARK: '#remark',
        QTY: '#amount',
        UNIT: '#unit',
        COST: '#total'
    };

    const RULES = [
        { defect: '混凝土裂縫', groups: ['混凝土裂縫', '非裂'], keyword: '非裂', method: '塗抹環氧樹脂修復(裂縫寬度＜0.3mm)', price: 800, autoRemark: '劣化類型:非結構性裂縫（材料、乾縮裂縫等）裂縫寬度<0.3mm', unit: '平方公尺' },
        { defect: '混凝土裂縫', groups: ['混凝土裂縫', '結構裂(>0.3mm)'], keyword: '結構裂(>0.3mm)', method: '環氧樹脂裂縫灌注(裂縫寬度≧0.3mm)', price: 1500, autoRemark: '劣化類型:結構性裂縫，裂縫寬度>0.3mm', unit: '公尺' },
        { defect: '混凝土蜂窩或剝落破損', groups: ['混凝土蜂窩或剝落破損', '剝落', '混剝'], keyword: '混剝', method: '混凝土修復', price: 2500, autoRemark: '', unit: '平方公尺' },
        { defect: '鋼筋裸露且銹蝕', groups: ['鋼筋裸露且銹蝕', '鋼筋裸露', '鋼筋外露', '鋼露'], keyword: '鋼露', method: '鋼筋除鏽及混凝土修復', price: 4500, autoRemark: '', unit: '平方公尺' },
        { defect: '混凝土蜂窩或剝落破損', groups: ['混凝土蜂窩或剝落破損', '蜂窩', '混蜂'], keyword: '混蜂', method: '表面蜂窩修補', price: 2500, autoRemark: '', unit: '平方公尺' },
        { defect: '滲水、白華', groups: ['滲水、白華', '白華'], keyword: '白華', method: '白華處理', price: 3000, autoRemark: '', unit: '平方公尺' },
        { defect: '滲水、白華且有銹水流出', groups: ['滲水、白華且有銹水流出', '銹水', '滲水白華','白華'], keyword: '滲水白華', method: '滲水白華裂縫處理', price: 3500, autoRemark: '', unit: '平方公尺' },
        { defect: '其他', groups: ['其他', '水痕'], keyword: '水痕', method: '持續觀察', price: 0, autoRemark: '劣化類型:水痕', unit: '式' },
        { defect: '積土或雜物堆積', groups: ['積土或雜物堆積', '積土', '清雜'], keyword: '清雜', method: '清除雜物', price: 2000, autoRemark: '', unit: '處' },
        { defect: '模板未拆除', groups: ['模板未拆除', '模板'], keyword: '模板', method: '清除雜物', price: 500, autoRemark: '', unit: '處' },
        { defect: '模板未拆除', groups: ['模板未拆除', '模板(大)'], keyword: '模板(大)', method: '清除雜物', price: 2000, autoRemark: '', unit: '處' },
        { defect: '其他', groups: ['其他', '鋼凸'], keyword: '鋼凸', method: '鋼筋凸出切除', price: 300, autoRemark: '劣化類型:鋼筋凸出', unit: '處' },
        { defect: '寄居生物巢穴、排泄物', groups: ['寄居生物巢穴、排泄物', '巢穴'], keyword: '巢穴', method: '清除雜物', price: 2000, autoRemark: '', unit: '處' },
        { defect: '漏水', groups: ['漏水'], keyword: '漏水', method: 'PVC排水管止漏', price: 1000, autoRemark: '', unit: '處' },
        { defect: '積水或洩水孔堵塞', groups: ['積水或洩水孔堵塞','洩水孔堵塞', '積水'], keyword: '積水', method: '管線修復、抽排水', price: 6000, autoRemark: '', unit: '工' },
        { defect: '螺栓損傷、欠缺及鬆動', groups: ['螺栓損傷、欠缺及鬆動', '螺栓損傷', '螺栓欠缺', '螺栓鬆動'], keyword: '螺栓鬆動', method: '螺栓補鎖', price: 200, autoRemark: '', unit: '個' }
    ];

    // 🛡️ 強化：將備註依長度由長到短排序，防止短字串誤殺長字串的重疊字元
    const ACTIVE_AUTO_REMARKS = RULES.map(r => r.autoRemark)
                                     .filter(Boolean)
                                     .sort((a, b) => b.length - a.length);

    const uniqueMap = new Map();
    RULES.forEach(r => {
        if (!uniqueMap.has(r.defect)) uniqueMap.set(r.defect, r.defect);
        if (!uniqueMap.has(r.keyword)) uniqueMap.set(r.keyword, r.defect);
        r.groups.forEach(g => {
            if (!uniqueMap.has(g)) uniqueMap.set(g, r.defect);
        });
    });

    const ALL_KEYWORDS = Array.from(uniqueMap.entries())
        .map(([searchStr, defectName]) => ({ searchStr, defectName }))
        .sort((a, b) => b.searchStr.length - a.searchStr.length);

    // ==========================================
    // 2. 狀態管理區 (State Management)
    // ==========================================
    let inputTimeout = null;
    let isUpdating = false;
    let lastKnownValues = { COMP: null, DEFECT: null, DEFECT_TEXT: null, REMARK: null };

    // ==========================================
    // 3. 工具函式區 (Utility Functions)
    // ==========================================
    function isTargetField(el) {
        if (!el || typeof el.matches !== 'function') return false;
        return Object.values(SELECTORS).some(selector => el.matches(selector));
    }

    function triggerChange(element) {
        if (element) element.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function getSelectOrInputValue(el) {
        if (!el) return "";
        return el.tagName === 'SELECT' ? (el.options[el.selectedIndex]?.text || '') : el.value;
    }

    function cleanOldAutoRemarks(currentRemarkStr) {
        let newStr = currentRemarkStr;
        ACTIVE_AUTO_REMARKS.forEach(ar => {
            // 🛡️ 強化：使用 split.join 確保替換掉「所有」可能重複出現的自動備註
            if (newStr.includes(ar)) {
                newStr = newStr.split(ar).join('');
            }
        });
        // 🛡️ 強化正則：清除因為刪除文字而產生的「連續多行空白」
        return newStr.replace(/\n\s*\n/g, '\n').replace(/^\s*[\r\n]/gm, '').trim();
    }

    function clearAutofills(els) {
        if (els.method) {
            if (els.method.value !== '') {
                els.method.value = '';
                triggerChange(els.method);
            }
            delete els.method.dataset.btnPrice;
            delete els.method.dataset.btnMethod;
        }

        if (els.remark) {
            let cleanedRemark = cleanOldAutoRemarks(els.remark.value);
            if (els.remark.value !== cleanedRemark) {
                els.remark.value = cleanedRemark;
                triggerChange(els.remark);
                lastKnownValues.REMARK = els.remark.value;
            }
        }

        if (els.unit && els.unit.value !== '') {
            els.unit.value = '';
            triggerChange(els.unit);
        }

        calculateCost(els);
    }

    // ==========================================
    // 4. 核心業務邏輯 (Core Business Logic)
    // ==========================================
    function initScript() {
        function handleEvent(e) {
            if (isUpdating) return;
            if (!isTargetField(e.target)) return;

            clearTimeout(inputTimeout);
            inputTimeout = setTimeout(() => {
                isUpdating = true;
                try {
                    processAllLogic(e.target);
                } finally {
                    setTimeout(() => { isUpdating = false; }, 50);
                }
            }, 300);
        }

        document.body.addEventListener('input', handleEvent);
        document.body.addEventListener('change', handleEvent);
    }

    function updateCompButtons(compText, remarkEl) {
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
                let currentRemark = remarkEl.value;

                btns.forEach(b => {
                    currentRemark = currentRemark.replace(b, '').replace(/^\s*[\r\n]/gm, '').trim();
                });

                remarkEl.value = currentRemark ? btnText + '\n' + currentRemark : btnText;
                triggerChange(remarkEl);
                lastKnownValues.REMARK = remarkEl.value;
            };
            btnContainer.appendChild(btn);
        });

        remarkEl.parentNode.insertBefore(btnContainer, remarkEl.nextSibling);
    }

    function calculateCost(els) {
        if (!els.qty || !els.method || !els.total) return;

        let qty = parseFloat(els.qty.value);
        let methodText = els.method.value.trim();
        let defectText = getSelectOrInputValue(els.defect) || (els.defectText ? els.defectText.value : "");
        let currentPrice = -1;

        if (methodText) {
            let activeRules = [];
            let maxScore = 0;

            if (defectText) {
                RULES.forEach(rule => {
                    let score = 0;
                    if (defectText.includes(rule.defect)) score = Math.max(score, rule.defect.length);
                    if (defectText.includes(rule.keyword)) score = Math.max(score, rule.keyword.length);
                    rule.groups.forEach(g => {
                        if (defectText.includes(g)) score = Math.max(score, g.length);
                    });

                    if (score > 0) {
                        if (score > maxScore) {
                            maxScore = score;
                            activeRules = [rule];
                        } else if (score === maxScore) {
                            activeRules.push(rule);
                        }
                    }
                });
            }

            let targetRule = activeRules.length > 0
                ? activeRules.find(r => r.method === methodText || r.method.includes(methodText) || methodText.includes(r.method))
                : null;

            if (els.method.dataset.btnPrice && els.method.dataset.btnMethod === methodText) {
                currentPrice = parseFloat(els.method.dataset.btnPrice);
            } else if (targetRule) {
                currentPrice = targetRule.price;
            } else {
                let maxLen = 0;
                for (const rule of RULES) {
                    let pureMethod = rule.method.replace(/\(.*\)/, '');
                    if ((methodText === rule.method || methodText.includes(rule.method) || methodText === pureMethod) && rule.method.length > maxLen) {
                        currentPrice = rule.price;
                        maxLen = rule.method.length;
                    }
                }
            }
        }

        if (currentPrice >= 0 && !isNaN(qty) && methodText !== "") {
            let totalCost = qty * currentPrice;
            if (parseFloat(els.total.value) !== totalCost || els.total.value === "") {
                els.total.value = totalCost;
                triggerChange(els.total);
            }
        } else {
             if (els.total.value !== "") {
                 els.total.value = "";
                 triggerChange(els.total);
             }
        }
    }

    function processAllLogic(targetEl) {
        const els = {
            comp: document.querySelector(SELECTORS.COMP),
            defect: document.querySelector(SELECTORS.DEFECT),
            defectText: document.querySelector(SELECTORS.DEFECT_TEXT),
            method: document.querySelector(SELECTORS.METHOD),
            remark: document.querySelector(SELECTORS.REMARK),
            qty: document.querySelector(SELECTORS.QTY),
            total: document.querySelector(SELECTORS.COST),
            unit: document.querySelector(SELECTORS.UNIT)
        };

        if (els.comp) {
            let compText = getSelectOrInputValue(els.comp);
            if (compText !== lastKnownValues.COMP) {
                lastKnownValues.COMP = compText;
                updateCompButtons(compText, els.remark);
            }
        }

        if (els.defect) lastKnownValues.DEFECT = getSelectOrInputValue(els.defect);
        if (els.defectText) lastKnownValues.DEFECT_TEXT = els.defectText.value;
        if (els.remark) lastKnownValues.REMARK = els.remark.value;

        if (els.remark && els.defectText) {
            let remarkText = els.remark.value;
            if (remarkText) {
                let tempRemarkForSearch = cleanOldAutoRemarks(remarkText);
                let matchedItem = ALL_KEYWORDS.find(kw => tempRemarkForSearch.includes(kw.searchStr));

                if (matchedItem) {
                    let newRemarkStr = remarkText.replace(matchedItem.searchStr, '').trim();
                    if (newRemarkStr.startsWith('\n')) newRemarkStr = newRemarkStr.substring(1).trim();

                    els.remark.value = newRemarkStr;
                    triggerChange(els.remark);
                    lastKnownValues.REMARK = els.remark.value;

                    els.defectText.value = matchedItem.defectName;
                    triggerChange(els.defectText);
                    lastKnownValues.DEFECT_TEXT = matchedItem.defectName;

                    targetEl = els.defectText;
                }
            }
        }

        if (targetEl.matches(SELECTORS.DEFECT) || targetEl.matches(SELECTORS.DEFECT_TEXT)) {
            let text = getSelectOrInputValue(targetEl);

            if (text) {
                let scoredRules = [];
                let maxScore = 0;

                RULES.forEach(rule => {
                    let score = 0;
                    if (text.includes(rule.defect)) score = Math.max(score, rule.defect.length);
                    if (text.includes(rule.keyword)) score = Math.max(score, rule.keyword.length);
                    rule.groups.forEach(g => {
                        if (text.includes(g)) score = Math.max(score, g.length);
                    });

                    if (score > 0) {
                        scoredRules.push({ rule, score });
                        maxScore = Math.max(maxScore, score);
                    }
                });

                let matchedRules = [];
                scoredRules.filter(sr => sr.score === maxScore).forEach(sr => {
                    if (!matchedRules.some(r => r.keyword === sr.rule.keyword)) {
                        matchedRules.push(sr.rule);
                    }
                });

                if (els.method) {
                    let oldContainer = document.querySelector('.tm-btn-container');

                    if (matchedRules.length === 0) {
                        if (oldContainer) oldContainer.remove();
                        clearAutofills(els);
                    } else if (matchedRules.length === 1) {
                        if (oldContainer) oldContainer.remove();
                        fillMethod(els, matchedRules[0]);
                    } else {
                        clearAutofills(els);
                        createShortcutButtons(els.method, matchedRules, els);
                    }
                }
            } else {
                let oldContainer = document.querySelector('.tm-btn-container');
                if (oldContainer) oldContainer.remove();
                clearAutofills(els);
            }
        }

        // 🐛 核心 UX 修復：如果使用者是手動編輯「維修工法」，只解除鎖定並算錢，絕不強制覆寫文字！
        if (targetEl.matches(SELECTORS.METHOD)) {
            delete targetEl.dataset.btnPrice;
            delete targetEl.dataset.btnMethod;
            // 移除了舊版會自動強制 fillMethod 蓋掉使用者手動輸入的壞邏輯，保持使用者體驗順暢。
        }

        // 統一在最後調用一次計價，處理數量改變或工法手動更改的價格更新
        calculateCost(els);
    }

    function createShortcutButtons(targetInput, rules, els) {
        let ruleKeys = rules.map(r => r.keyword).join('|');
        let oldContainer = document.querySelector('.tm-btn-container');

        if (oldContainer) {
            if (oldContainer.dataset.rules === ruleKeys) return;
            oldContainer.remove();
        }

        let btnContainer = document.createElement('span');
        btnContainer.className = 'tm-btn-container';
        btnContainer.dataset.rules = ruleKeys;
        btnContainer.style.marginLeft = '10px';

        rules.forEach(rule => {
            let btn = document.createElement('button');
            btn.textContent = rule.keyword;
            btn.title = rule.method;
            btn.style.cssText = 'margin-right: 5px; padding: 3px 8px; cursor: pointer; font-size: 13px; background: #007BFF; color: white; border: none; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.2); transition: 0.2s;';

            btn.onmouseover = () => { if (btn.style.background !== 'rgb(40, 167, 69)') btn.style.background = '#0056b3'; };
            btn.onmouseout = () => { if (btn.style.background !== 'rgb(40, 167, 69)') btn.style.background = '#007BFF'; };

            btn.onclick = (e) => {
                e.preventDefault();
                targetInput.dataset.btnPrice = rule.price;
                targetInput.dataset.btnMethod = rule.method;

                fillMethod(els, rule);
                Array.from(btnContainer.children).forEach(b => b.style.background = '#007BFF');
                btn.style.background = '#28A745';
            };
            btnContainer.appendChild(btn);
        });

        targetInput.parentNode.insertBefore(btnContainer, targetInput.nextSibling);
    }

    function fillMethod(els, rule) {
        if (!rule) return;

        if (els.method) {
            els.method.dataset.btnPrice = rule.price;
            els.method.dataset.btnMethod = rule.method;
            if (els.method.value !== rule.method) {
                els.method.value = rule.method;
                triggerChange(els.method);
            }
        }

        if (rule.autoRemark !== undefined && els.remark) {
            let currentVal = cleanOldAutoRemarks(els.remark.value);

            if (rule.autoRemark) {
                currentVal = currentVal ? currentVal + '\n' + rule.autoRemark : rule.autoRemark;
            }

            if (els.remark.value !== currentVal) {
                els.remark.value = currentVal;
                triggerChange(els.remark);
                lastKnownValues.REMARK = els.remark.value;
            }
        }

        if (rule.unit && els.unit) {
            if (els.unit.tagName === 'SELECT') {
                let targetOption = Array.from(els.unit.options).find(opt => opt.text === rule.unit || opt.value === rule.unit);
                if (targetOption && els.unit.value !== targetOption.value) {
                    els.unit.value = targetOption.value;
                    triggerChange(els.unit);
                }
            } else if (els.unit.value !== rule.unit) {
                els.unit.value = rule.unit;
                triggerChange(els.unit);
            }
        }

        calculateCost(els);
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        initScript();
    } else {
        window.addEventListener('DOMContentLoaded', initScript);
    }

})();
