// ==UserScript==
// @name         橋梁系統自動填寫與計算經費_自行車橋版
// @namespace    http://tampermonkey.net/
// @version      0.7.2
// @description  自動補齊名稱、填寫工法、並自動填入單價
// @match        *://bms2.iot.gov.tw/*
// @run-at       document-idle
// @grant        none
// @downloadURL  https://gist.github.com/lin3274/Bridge-Inspection/raw/橋梁系統自動填寫與計算經費_自行車橋版.user.js
// @updateURL    https://gist.github.com/lin3274/Bridge-Inspection/raw/橋梁系統自動填寫與計算經費_自行車橋版.user.js
// @license     MIT
// ==/UserScript==

(function() {
    'use strict';

    console.log('[橋梁外掛] ⏳ 腳本 v0.7.2 待命... 等待網頁核心載入完成...');

    // 🌟 修改點 1：移除數量與總價，改為單價(PRICE)
    const SELECTORS = {
        DEFECT: '#deterioration',
        DEFECT_TEXT: '#deterioration_text',
        METHOD: '#method',
        REMARK: '#remark',
        PRICE: '#price'
    };

    const RULES = [
        { defect: '非結構性裂縫（材料、乾縮裂縫等）', groups: ['非結構性裂縫'], keyword: '非裂(>0.3mm)', method: '環氧樹脂裂縫灌注(裂縫寬度≧0.3mm)', price: 1620 },
        { defect: '非結構性裂縫（材料、乾縮裂縫等）', groups: ['非結構性裂縫'], keyword: '非裂', method: '塗抹環氧樹脂修復(裂縫寬度＜0.3mm)', price: 864 },
        { defect: '混凝土結構裂縫', groups: ['混凝土結構裂縫'], keyword: '結構裂', method: '環氧樹脂裂縫灌注(裂縫寬度≧0.3mm)', price: 1620 },
        { defect: '混凝土剝落、破碎、鋼筋外露、銹蝕', groups: ['混凝土剝落', '破碎', '銹蝕', '鋼筋外露'], keyword: '鋼露', method: '鋼筋除鏽及混凝土修復', price: 4860 },
        { defect: '混凝土剝落、破碎、鋼筋外露、銹蝕', groups: ['混凝土剝落', '破碎', '銹蝕', '鋼筋外露'], keyword: '混剝', method: '混凝土修復', price: 2700 },
        { defect: '混凝土蜂窩', groups: ['混凝土蜂窩'], keyword: '混蜂', method: '表面蜂窩修補', price: 2700 },
        { defect: '植物生長', groups: ['植物生長'], keyword: '植生', method: '植物清除', price: 1998 },
        { defect: '滲水、白華', groups: ['滲水', '白華'], keyword: '滲水白華', method: '滲水白華裂縫處理', price: 3780 },
        { defect: '滲水、白華', groups: ['滲水', '白華'], keyword: '白華', method: '白華處理', price: 3240 },
        { defect: '混凝土表面水痕', groups: ['混凝土表面水痕'], keyword: '水痕', method: '持續觀察', price: 0 },
        { defect: '雜物堆積', groups: ['雜物堆積'], keyword: '清雜(大)', method: '清除雜物', price: 2160 },
        { defect: '雜物堆積', groups: ['雜物堆積'], keyword: '清雜', method: '清除雜物', price: 540 },
        { defect: '模板未拆', groups: ['模板未拆'], keyword: '模板', method: '清除雜物', price: 540 },
        { defect: '鋼筋凸出', groups: ['鋼筋凸出'], keyword: '鋼凸', method: '鋼筋凸出切除', price: 324 },
        { defect: '河道沖淤或變遷', groups: ['河道沖淤', '變遷'], keyword: '河道', method: '河道雜物清除', price: 2160 },
        { defect: '生銹或腐蝕', groups: ['生銹或腐蝕'], keyword: '支承鏽蝕', method: '支承(墊)除鏽及油漆塗裝', price: 5400 },
        { defect: '支承座、支承端部損傷', groups: ['支承座、支承端部損傷', '支承座', '支承端部'], keyword: '支承座損傷', method: '鋼筋除鏽及混凝土修復', price: 4860 },
        { defect: '塵土、雜物、植生堆積', groups: ['塵土、雜物、植生堆積', '塵土', '植生堆積'], keyword: '支承雜堆', method: '清除雜物', price: 2160 },
        { defect: '防止落橋裝置損傷', groups: ['防落', '防落橋裝置損傷'], keyword: '防落損傷U<3', method: '鋼筋除鏽及混凝土修復', price: 4860 },
        { defect: '防止落橋裝置損傷', groups: ['防落', '防落橋裝置損傷'], keyword: '防落損傷U≧3', method: '混凝土止震塊修復', price: 2700 },
        { defect: '防落墊老化', groups: ['防落墊', '防落墊老化'], keyword: '防落墊老化', method: '持續觀察', price: 0 },
        { defect: '塗裝劣化、生銹或腐蝕', groups: ['塗裝劣化', '生銹或腐蝕'], keyword: '塗劣', method: '鋼構除鏽及油漆塗裝', price: 540 },

    ];

    const KEYWORD_MAP = [];
    RULES.forEach(r => {
        KEYWORD_MAP.push({ searchStr: r.defect, defectName: r.defect });
        KEYWORD_MAP.push({ searchStr: r.keyword, defectName: r.defect });
        r.groups.forEach(g => {
            KEYWORD_MAP.push({ searchStr: g, defectName: r.defect });
        });
    });

    const uniqueMap = new Map();
    KEYWORD_MAP.forEach(item => {
        if (!uniqueMap.has(item.searchStr)) uniqueMap.set(item.searchStr, item.defectName);
    });
    const ALL_KEYWORDS = [];
    uniqueMap.forEach((defectName, searchStr) => ALL_KEYWORDS.push({ searchStr, defectName }));
    ALL_KEYWORDS.sort((a, b) => b.searchStr.length - a.searchStr.length);

    let inputTimeout = null;
    let isUpdating = false;
    let lastKnownValues = { DEFECT: null, DEFECT_TEXT: null, REMARK: null };

    // 🌟 修改點 2：事件監聽目標改為包含 PRICE
    function isTargetField(el) {
        if (!el || typeof el.matches !== 'function') return false;
        return el.matches(SELECTORS.DEFECT) || el.matches(SELECTORS.DEFECT_TEXT) ||
               el.matches(SELECTORS.METHOD) || el.matches(SELECTORS.REMARK) || el.matches(SELECTORS.PRICE);
    }

    function initScript() {
        function handleEvent(e) {
            if (isUpdating) return;
            if (!isTargetField(e.target)) return;
            clearTimeout(inputTimeout);
            inputTimeout = setTimeout(() => processAllLogic(e.target), 300);
        }

        document.body.addEventListener('input', handleEvent);
        document.body.addEventListener('change', handleEvent);
        setInterval(autoScanner, 800);
    }

    function autoScanner() {
        if (isUpdating) return;
        let defectEl = document.querySelector(SELECTORS.DEFECT);
        let defectTextEl = document.querySelector(SELECTORS.DEFECT_TEXT);
        let remarkEl = document.querySelector(SELECTORS.REMARK);

        if (defectEl) {
            let text = defectEl.tagName === 'SELECT' ? (defectEl.selectedIndex >= 0 ? defectEl.options[defectEl.selectedIndex].text : '') : defectEl.value;
            if (text !== lastKnownValues.DEFECT) { if (text) processAllLogic(defectEl); }
        }
        if (defectTextEl) {
            let text = defectTextEl.value;
            if (text !== lastKnownValues.DEFECT_TEXT) { if (text) processAllLogic(defectTextEl); }
        }
        if (remarkEl) {
            let text = remarkEl.value;
            if (text !== lastKnownValues.REMARK) { if (text) processAllLogic(remarkEl); }
        }
    }

    // 🌟 修改點 3：重構函數名稱與內部邏輯，改為直接填寫單價
    function updatePrice() {
        let methodEl = document.querySelector(SELECTORS.METHOD);
        let priceEl = document.querySelector(SELECTORS.PRICE);
        let dtEl = document.querySelector(SELECTORS.DEFECT_TEXT);

        if (methodEl && priceEl) {
            let methodText = methodEl.value;
            let defectText = dtEl ? dtEl.value : "";
            let currentPrice = -1;
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

            let targetRule = null;
            if (activeRules.length > 0) {
                targetRule = activeRules.find(r =>
                    r.method === methodText ||
                    r.method.includes(methodText) ||
                    methodText.includes(r.method)
                );
            }

            if (targetRule) {
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

            // 直接填入單價
            if (currentPrice >= 0) {
                if (parseFloat(priceEl.value) !== currentPrice || priceEl.value === "") {
                    priceEl.value = currentPrice;
                    priceEl.dispatchEvent(new Event('change', { bubbles: true }));
                    // console.log(`[橋梁外掛] 💰 已自動填入單價: ${currentPrice}`);
                }
            }
        }
    }

    function processAllLogic(targetEl) {
        isUpdating = true;

        try {
            let dEl = document.querySelector(SELECTORS.DEFECT);
            if (dEl) lastKnownValues.DEFECT = dEl.tagName === 'SELECT' ? (dEl.selectedIndex >= 0 ? dEl.options[dEl.selectedIndex].text : '') : dEl.value;
            let dtEl = document.querySelector(SELECTORS.DEFECT_TEXT);
            if (dtEl) lastKnownValues.DEFECT_TEXT = dtEl.value;
            let rEl = document.querySelector(SELECTORS.REMARK);
            if (rEl) lastKnownValues.REMARK = rEl.value;

            let remarkEl = document.querySelector(SELECTORS.REMARK);
            let defectTextEl = document.querySelector(SELECTORS.DEFECT_TEXT);

            if (remarkEl && defectTextEl) {
                let remarkText = remarkEl.value;
                if (remarkText) {
                    let matchedItem = null;
                    for (const kw of ALL_KEYWORDS) {
                        if (remarkText.includes(kw.searchStr)) {
                            matchedItem = kw;
                            break;
                        }
                    }

                    if (matchedItem) {
                        remarkEl.value = remarkText.replace(matchedItem.searchStr, '').trim();
                        remarkEl.dispatchEvent(new Event('change', { bubbles: true }));
                        lastKnownValues.REMARK = remarkEl.value;

                        defectTextEl.value = matchedItem.defectName;
                        defectTextEl.dispatchEvent(new Event('change', { bubbles: true }));
                        lastKnownValues.DEFECT_TEXT = matchedItem.defectName;

                        targetEl = defectTextEl;
                    }
                }
            }

            if (targetEl.matches(SELECTORS.DEFECT) || targetEl.matches(SELECTORS.DEFECT_TEXT)) {
                let text = targetEl.tagName === 'SELECT' ?
                           targetEl.options[targetEl.selectedIndex]?.text :
                           targetEl.value;

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
                        if (!matchedRules.some(r => r.method === sr.rule.method)) {
                            matchedRules.push(sr.rule);
                        }
                    });

                    let methodEl = document.querySelector(SELECTORS.METHOD);
                    if (methodEl) {
                        if (matchedRules.length === 0) {
                            let oldContainer = document.querySelector('.tm-btn-container');
                            if (oldContainer) oldContainer.remove();
                        } else if (matchedRules.length === 1) {
                            let oldContainer = document.querySelector('.tm-btn-container');
                            if (oldContainer) oldContainer.remove();
                            fillMethod(methodEl, matchedRules[0].method);
                        } else {
                            createShortcutButtons(methodEl, matchedRules);
                        }
                    }
                }
            }

            if (targetEl.matches(SELECTORS.METHOD)) {
                let methodText = targetEl.value;
                if (methodText) {
                    let targetRule = null;
                    let maxKwLen = 0;
                    RULES.forEach(rule => {
                        if (methodText.includes(rule.keyword) && rule.keyword.length > maxKwLen) {
                            targetRule = rule;
                            maxKwLen = rule.keyword.length;
                        }
                    });

                    if (targetRule && methodText !== targetRule.method) {
                        fillMethod(targetEl, targetRule.method);
                        let oldContainer = document.querySelector('.tm-btn-container');
                        if (oldContainer) oldContainer.remove();
                    }
                }
            }

            // 🌟 呼叫新的填入單價函數
            updatePrice();

        } finally {
            setTimeout(() => { isUpdating = false; }, 100);
        }
    }

    function createShortcutButtons(targetInput, rules) {
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
                fillMethod(targetInput, rule.method);
                Array.from(btnContainer.children).forEach(b => b.style.background = '#007BFF');
                btn.style.background = '#28A745';
            };
            btnContainer.appendChild(btn);
        });

        targetInput.parentNode.insertBefore(btnContainer, targetInput.nextSibling);
    }

    function fillMethod(inputEl, methodText) {
        if (inputEl.value !== methodText) {
            inputEl.value = methodText;
            inputEl.dispatchEvent(new Event('change', { bubbles: true }));
        }
        // 🌟 填寫工法後更新單價
        updatePrice();
    }

    if (document.readyState === 'complete') {
        initScript();
    } else {
        window.addEventListener('load', initScript);
    }

})();
