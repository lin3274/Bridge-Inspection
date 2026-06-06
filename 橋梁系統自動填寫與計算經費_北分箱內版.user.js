// ==UserScript==
// @name         橋梁系統自動填寫與計算經費_北分箱內版
// @namespace    http://tampermonkey.net/
// @version      0.9.3
// @description  自動更新規則、自動填寫單位、新增構件專屬備註快捷鍵
// @match        *://thbpbms.thb.gov.tw/*
// @run-at       document-idle
// @grant        none
// @downloadURL  https://gist.github.com/lin3274/e5c8ee28dd176ba9e9a26f15f329f2c9/raw/橋梁系統自動填寫與計算經費_北分箱內版.user.js
// @updateURL    https://gist.github.com/lin3274/e5c8ee28dd176ba9e9a26f15f329f2c9/raw/橋梁系統自動填寫與計算經費_北分箱內版.user.js
// @license     MIT
// ==/UserScript==

(function() {
    'use strict';

    console.log('[橋梁外掛] ⏳ 腳本 v0.9 待命... 已新增構件選擇連動備註按鈕功能。');

    // 🌟 選擇器更新：加入 COMP 欄位
    const SELECTORS = {
        COMP: '#boxinsp_comp', // 構件欄位
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
    let lastKnownValues = { COMP: null, DEFECT: null, DEFECT_TEXT: null, REMARK: null };

    function isTargetField(el) {
        if (!el || typeof el.matches !== 'function') return false;
        return el.matches(SELECTORS.COMP) || el.matches(SELECTORS.DEFECT) ||
               el.matches(SELECTORS.DEFECT_TEXT) || el.matches(SELECTORS.METHOD) ||
               el.matches(SELECTORS.REMARK) || el.matches(SELECTORS.QTY);
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

        let compEl = document.querySelector(SELECTORS.COMP);
        let defectEl = document.querySelector(SELECTORS.DEFECT);
        let defectTextEl = document.querySelector(SELECTORS.DEFECT_TEXT);
        let remarkEl = document.querySelector(SELECTORS.REMARK);

        // 🌟 新增：監聽構件欄位變化
        if (compEl) {
            let text = compEl.tagName === 'SELECT' ? (compEl.selectedIndex >= 0 ? compEl.options[compEl.selectedIndex].text : '') : compEl.value;
            if (text !== lastKnownValues.COMP) {
                lastKnownValues.COMP = text;
                updateCompButtons(text);
            }
        }

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

    // 🌟 新增：產生構件專屬快捷按鈕的功能
    function updateCompButtons(compText) {
        let remarkEl = document.querySelector(SELECTORS.REMARK);
        if (!remarkEl) return;

        // 移除舊的按鈕容器
        let oldContainer = document.querySelector('.tm-comp-btn-container');
        if (oldContainer) oldContainer.remove();

        let btns = [];
        // 判斷選定的構件並產生對應按鈕
        if (compText.includes('端隔梁')) {
            btns = ['劣化構件:橋尾側端隔梁', '劣化構件:橋頭側端隔梁'];
        } else if (compText.includes('隔板(橫隔梁)')) {
            btns = ['劣化構件:橋尾側隔板', '劣化構件:橋頭側隔板'];
        } else if (compText.includes('其他')) {
            btns = ['劣化構件:支承剪力裝置'];
        }

        if (btns.length === 0) return; // 如果不是指定構件，就不產生按鈕

        let btnContainer = document.createElement('div');
        btnContainer.className = 'tm-comp-btn-container';
        btnContainer.style.cssText = 'margin-top: 8px; margin-bottom: 8px;';

        btns.forEach(btnText => {
            let btn = document.createElement('button');
            btn.textContent = btnText;
            btn.style.cssText = 'margin-right: 8px; padding: 4px 10px; cursor: pointer; font-size: 13px; background: #17a2b8; color: white; border: none; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.2); transition: 0.2s;';

            btn.onmouseover = () => { btn.style.background = '#138496'; };
            btn.onmouseout = () => { btn.style.background = '#17a2b8'; };

            btn.onclick = (e) => {
                e.preventDefault();
                let currentRemark = remarkEl.value;

                // 貼心設計：先清除同一組的其他方向備註，避免重複疊加 (如: 同時出現橋頭側跟橋尾側)
                btns.forEach(b => {
                    currentRemark = currentRemark.replace(b, '').replace(/^\s*[\r\n]/gm, '').trim();
                });

                // 將選取的字眼塞入備註的最前方
                remarkEl.value = currentRemark ? btnText + '\n' + currentRemark : btnText;
                remarkEl.dispatchEvent(new Event('change', { bubbles: true }));
                lastKnownValues.REMARK = remarkEl.value;
            };
            btnContainer.appendChild(btn);
        });

        // 將按鈕掛載在備註欄位正上方或正下方 (此處掛在正下方)
        remarkEl.parentNode.insertBefore(btnContainer, remarkEl.nextSibling);
    }

    function calculateCost() {
        let amountEl = document.querySelector(SELECTORS.QTY);
        let methodEl = document.querySelector(SELECTORS.METHOD);
        let totalEl = document.querySelector(SELECTORS.COST);
        let dtEl = document.querySelector(SELECTORS.DEFECT_TEXT);

        if (amountEl && methodEl && totalEl) {
            let qty = parseFloat(amountEl.value);
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

            if (currentPrice >= 0 && !isNaN(qty)) {
                let totalCost = qty * currentPrice;
                if (parseFloat(totalEl.value) !== totalCost || totalEl.value === "") {
                    totalEl.value = totalCost;
                    totalEl.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        }
    }

    function processAllLogic(targetEl) {
        isUpdating = true;

        try {
            // 同步構件欄位狀態
            let compEl = document.querySelector(SELECTORS.COMP);
            if (compEl) {
                let compText = compEl.tagName === 'SELECT' ? (compEl.selectedIndex >= 0 ? compEl.options[compEl.selectedIndex].text : '') : compEl.value;
                if (compText !== lastKnownValues.COMP) {
                    lastKnownValues.COMP = compText;
                    updateCompButtons(compText);
                }
            }

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

                    let tempRemarkForSearch = remarkText;
                    let activeAutoRemarks = RULES.map(r => r.autoRemark).filter(r => r);
                    activeAutoRemarks.forEach(ar => {
                        if(tempRemarkForSearch.includes(ar)) {
                            tempRemarkForSearch = tempRemarkForSearch.replace(ar, '');
                        }
                    });

                    for (const kw of ALL_KEYWORDS) {
                        if (tempRemarkForSearch.includes(kw.searchStr)) {
                            matchedItem = kw;
                            break;
                        }
                    }

                    if (matchedItem) {
                        let newRemarkStr = remarkText.replace(matchedItem.searchStr, '').trim();
                        if (newRemarkStr.startsWith('\n')) newRemarkStr = newRemarkStr.substring(1).trim();

                        remarkEl.value = newRemarkStr;
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
                            fillMethod(methodEl, matchedRules[0]);
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
                        fillMethod(targetEl, targetRule);
                        let oldContainer = document.querySelector('.tm-btn-container');
                        if (oldContainer) oldContainer.remove();
                    }
                }
            }

            calculateCost();

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
                fillMethod(targetInput, rule);
                Array.from(btnContainer.children).forEach(b => b.style.background = '#007BFF');
                btn.style.background = '#28A745';
            };
            btnContainer.appendChild(btn);
        });

        targetInput.parentNode.insertBefore(btnContainer, targetInput.nextSibling);
    }

    function fillMethod(inputEl, rule) {
        if (!rule) return;

        // 1. 填入工法
        if (inputEl.value !== rule.method) {
            inputEl.value = rule.method;
            inputEl.dispatchEvent(new Event('change', { bubbles: true }));
        }

        // 2. 填入備註
        if (rule.autoRemark) {
            let remarkEl = document.querySelector(SELECTORS.REMARK);
            if (remarkEl && !remarkEl.value.includes(rule.autoRemark)) {
                let currentVal = remarkEl.value.trim();
                remarkEl.value = currentVal ? currentVal + '\n' + rule.autoRemark : rule.autoRemark;
                remarkEl.dispatchEvent(new Event('change', { bubbles: true }));
                lastKnownValues.REMARK = remarkEl.value;
            }
        }

        // 3. 填入單位
        if (rule.unit) {
            let unitEl = document.querySelector(SELECTORS.UNIT);
            if (unitEl) {
                if (unitEl.tagName === 'SELECT') {
                    let options = Array.from(unitEl.options);
                    let targetOption = options.find(opt => opt.text === rule.unit || opt.value === rule.unit);
                    if (targetOption && unitEl.value !== targetOption.value) {
                        unitEl.value = targetOption.value;
                        unitEl.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                } else {
                    if (unitEl.value !== rule.unit) {
                        unitEl.value = rule.unit;
                        unitEl.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }
            }
        }

        calculateCost();
    }

    if (document.readyState === 'complete') {
        initScript();
    } else {
        window.addEventListener('load', initScript);
    }

})();