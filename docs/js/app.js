$(document).ready(function() {
    // 此处代码将在 painter.js 加载并绘制完地铁图后执行
    // 我们需要确保 linesMeta 已经有数据
    var checkLinesMetaInterval = setInterval(function() {
        if (typeof linesMeta !== 'undefined' && linesMeta.length > 0) {
            clearInterval(checkLinesMetaInterval);
            initializeControls();
        }
    }, 100);

    function initializeControls() {
        var $lineList = $('#line-list');
        if (!$lineList.length) {
            console.error('无法找到 #line-list 元素');
            return;
        }

        var highlightMode = 0; // 0: 取消高亮, 1: 悬浮高亮, 2: 选中高亮
        var highlightTimeout = null;
        var currentHighlightLine = null;

        // 根据 spacing 对象构建有序的站点列表（仅包含同一条线的站点）
        function buildOrderedStations(spacingObj, isLoop, preferOrder) {
            if (!spacingObj) return [];
            var stations = Object.keys(spacingObj);
            if (stations.length === 0) return [];

            var deg = {};
            stations.forEach(function(s) { deg[s] = Object.keys(spacingObj[s] || {}).length; });

            // 找到端点（度为1）作为起点；若无端点（loop），尝试使用 preferOrder 中的站点作为起点
            var start = null;
            for (var i = 0; i < stations.length; i++) {
                if (deg[stations[i]] === 1) { start = stations[i]; break; }
            }
            if (!start) {
                if (preferOrder && preferOrder.length) {
                    for (var i = 0; i < preferOrder.length; i++) {
                        if (stations.indexOf(preferOrder[i]) !== -1) { start = preferOrder[i]; break; }
                    }
                }
                if (!start) start = stations[0];
            }

            var order = [start];
            var seen = {};
            seen[start] = true;
            var cur = start;

            while (true) {
                var neighbors = Object.keys(spacingObj[cur] || {}).filter(function(n) { return stations.indexOf(n) !== -1; });
                var next = null;
                for (var j = 0; j < neighbors.length; j++) {
                    if (!seen[neighbors[j]]) { next = neighbors[j]; break; }
                }
                if (!next) break;
                order.push(next);
                seen[next] = true;
                cur = next;
            }

            if (isLoop && order.length > 0 && order[0] !== order[order.length - 1]) {
                order.push(order[0]);
            }

            return order;
        }

        // 动态生成线路列表
        linesMeta.forEach(function(line) {
            var listItem = `
                <li>
                    <label class="line-label-wrapper" for="chk-${line.code}">
                        <span class="line-color-indicator" style="background-color: ${line.color};"></span>
                        <span class="line-label">${line.label}</span>
                        <input type="checkbox" id="chk-${line.code}" data-code="${line.code}" checked>
                    </label>
                </li>
            `;
            $lineList.append(listItem);
        });

        // 构建站点索引（用于搜索）
        var stationIndex = []; // {name: 'xxx', lineCode: 'L1', xmlElem: jQueryElem}
        try {
            $(BJ.data).find('p').each(function() {
                var $p = $(this);
                var name = $p.attr('lb') || $p.attr('sb') || $p.attr('name');
                if (name) {
                    stationIndex.push({name: name, xml: $p});
                }
            });
        } catch (e) {
            // BJ.data may not be ready; leave empty
            console.warn('无法构建站点索引:', e);
        }

        // 搜索 UI 逻辑
        var $searchInput = $('#search-input');
        var $suggestions = $('#search-suggestions');
        var suggestionIndex = -1;

        function renderSuggestions(list) {
            if (!list || list.length === 0) {
                $suggestions.hide().empty();
                suggestionIndex = -1;
                return;
            }
            $suggestions.empty();
            list.forEach(function(item, idx) {
                var li = $('<li>').addClass('suggestion-item').attr('data-idx', idx).text(item.name).css({padding:'6px 8px',cursor:'pointer'});
                $suggestions.append(li);
            });
            $suggestions.show();
        }

        function filterStations(q) {
            if (!q) return [];
            q = q.trim();
            var low = q.toLowerCase();
            var out = stationIndex.filter(function(s){ return s.name && s.name.toLowerCase().indexOf(low) !== -1; });
            return out.slice(0, 20);
        }

        function clearSearchHighlight() {
            $('#g-box').find('.search-highlight').removeClass('search-highlight');
        }

        function flashSvgElement($elem) {
            if (!$elem || !$elem.length) return;
            // add flash and remove after animation
            $elem.addClass('search-flash');
            // ensure highlight appears during flash
            $elem.addClass('search-highlight');
            // animation duration 0.28s * 6 iterations = ~1.68s
            setTimeout(function(){
                $elem.removeClass('search-flash');
                $elem.removeClass('search-highlight');
            }, 1700);
        }

        function centerOnStationByName(name) {
            // find a matching SVG text element
            clearSearchHighlight();
            var $text = $('#g-box').find('text').filter(function(){ return $(this).text().trim() === name; }).first();
            if ($text && $text.length) {
                $text.addClass('search-highlight');
                var el = $text[0];
                try {
                    // try svg-pan-zoom instance common globals
                    var pan = window.panZoom || window.svgPanZoomInstance || window._svgPanZoom || window._panZoom || null;
                    var bbox = el.getBBox();
                    var cx = bbox.x + bbox.width/2;
                    var cy = bbox.y + bbox.height/2;

                    if (pan && typeof pan.getSizes === 'function' && typeof pan.pan === 'function') {
                        // 计算元素在 SVG 坐标系中的点（使用屏幕坐标->SVG坐标转换），以确保与 svg-pan-zoom 的坐标系统一致
                        var svgEl = document.getElementById('mobile-svg');
                        var screenRect = el.getBoundingClientRect();
                        var screenCX = screenRect.left + screenRect.width/2;
                        var screenCY = screenRect.top + screenRect.height/2;
                        var pt = svgEl.createSVGPoint();
                        pt.x = screenCX; pt.y = screenCY;
                        var svgP = pt.matrixTransform(svgEl.getScreenCTM().inverse());

                        var origZoom = (typeof pan.getZoom === 'function') ? pan.getZoom() : 1;
                        var origPan = (typeof pan.getPan === 'function') ? pan.getPan() : {x:0,y:0};
                        var targetZoom = Math.max(origZoom, 1) * 1.6;
                        if (typeof pan.zoom === 'function') pan.zoom(targetZoom);
                        // 以 svgP 为中心计算新的 pan，使该 svg 坐标映射到屏幕中心
                        var vw = svgEl.clientWidth || document.documentElement.clientWidth;
                        var vh = svgEl.clientHeight || document.documentElement.clientHeight;
                        var newPan = {x: vw/2 - svgP.x * targetZoom, y: vh/2 - svgP.y * targetZoom};
                        pan.pan(newPan);

                        // 触发闪烁动画（在 SVG 元素上）
                        try { flashSvgElement($text); } catch (fe) { console.warn('flash failed', fe); }

                        // 恢复到原始缩放与位置
                        setTimeout(function(){
                            try {
                                if (typeof pan.zoom === 'function') pan.zoom(origZoom);
                                if (typeof pan.pan === 'function' && origPan) pan.pan(origPan);
                            } catch(e) { console.warn('恢复缩放失败', e); }
                        }, 1400);
                    } else {
                        // fallback: scroll page so element bbox center is in viewport center
                        var rect = el.getBoundingClientRect();
                        var targetX = rect.left + rect.width/2 + window.pageXOffset - (window.innerWidth/2);
                        var targetY = rect.top + rect.height/2 + window.pageYOffset - (window.innerHeight/2);
                        window.scrollTo({left: targetX, top: targetY, behavior: 'smooth'});

                        // fallback: apply flash to SVG element (or page-level flash if SVG not present)
                        try { flashSvgElement($text); } catch (ex2) { console.warn('fallback flash failed', ex2); }
                    }
                } catch (ex) {
                    console.warn('centerOnStation error', ex);
                }
                return true;
            }
            return false;
        }

        // 输入事件
        $searchInput.on('input', function() {
            var q = $(this).val();
            if (!q || q.length === 0) { renderSuggestions([]); return; }
            var results = filterStations(q);
            renderSuggestions(results);
        });

        // 搜索按钮触发
        $('#search-btn').on('click', function(){
            var name = $searchInput.val();
            if (!name || name.trim().length === 0) return;
            renderSuggestions([]);
            if (!centerOnStationByName(name.trim())) {
                alert('未能在地图上定位站点: ' + name);
            }
        });

        // 键盘导航与回车
        $searchInput.on('keydown', function(e) {
            var items = $suggestions.find('.suggestion-item');
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                suggestionIndex = Math.min(suggestionIndex + 1, items.length - 1);
                items.removeClass('active').eq(suggestionIndex).addClass('active');
                return;
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                suggestionIndex = Math.max(suggestionIndex - 1, 0);
                items.removeClass('active').eq(suggestionIndex).addClass('active');
                return;
            } else if (e.key === 'Enter') {
                e.preventDefault();
                var sel = items.eq(suggestionIndex);
                var name = null;
                if (sel && sel.length) name = sel.text();
                if (!name) name = $searchInput.val();
                if (name) {
                    $searchInput.val(name);
                    renderSuggestions([]);
                    // center and highlight
                    if (!centerOnStationByName(name)) {
                        alert('未能在地图上定位站点: ' + name);
                    }
                }
                return;
            }
        });

        // 点击建议
        $suggestions.on('click', '.suggestion-item', function() {
            var name = $(this).text();
            $searchInput.val(name);
            renderSuggestions([]);
            if (!centerOnStationByName(name)) {
                alert('未能在地图上定位站点: ' + name);
            }
        });

        // 点击输入外区域隐藏建议
        $(document).on('click', function(e){ if (!$(e.target).closest('#search-input,#search-suggestions').length) { renderSuggestions([]); } });

        // 全选/全不选切换
        $('#toggle-all-lines').on('click', function() {
            var $checkboxes = $('#line-list input[type="checkbox"]');
            var allChecked = $checkboxes.length === $checkboxes.filter(':checked').length;
            
            if (allChecked) {
                // 如果全部已选，则全不选
                $checkboxes.prop('checked', false).trigger('change');
                $(this).text('全选');
            } else {
                // 否则，全选
                $checkboxes.prop('checked', true).trigger('change');
                $(this).text('全不选');
            }
        });

        // 单个线路的显隐切换
        $lineList.on('change', 'input[type="checkbox"]', function() {
            var code = $(this).data('code');
            var isChecked = $(this).is(':checked');
            if (isChecked) {
                $('.line-' + code).removeClass('dim');
                if (highlightMode === 2) {
                    $('.line-' + code).addClass('highlight').each(function() {
                        this.parentNode.appendChild(this);
                    });
                }
            } else {
                // 当线路被隐藏时，同时移除高亮和暗淡效果
                $('.line-' + code).addClass('dim').removeClass('highlight');
            }

            // 更新全选/全不选按钮的状态
            var $checkboxes = $('#line-list input[type="checkbox"]');
            var allChecked = $checkboxes.length === $checkboxes.filter(':checked').length;
            $('#toggle-all-lines').text(allChecked ? '全不选' : '全选');
        });

        // 高亮模式切换
        var modeTexts = ['高亮模式：取消高亮', '高亮模式：悬停高亮', '高亮模式：选中高亮'];
        $('#btn-highlight-mode').on('click', function() {
            highlightMode = (highlightMode + 1) % 3;
            $(this).text(modeTexts[highlightMode]);

            // 切换模式前先清除之前留下的高亮状态
            $('.subway-line').removeClass('highlight');
            clearTimeout(highlightTimeout);
            currentHighlightLine = null;

            if (highlightMode === 2) {
                // 选中高亮：将列表中打勾显示的线路高亮显示并置顶
                $('#line-list input[type="checkbox"]:checked').each(function() {
                    var code = $(this).data('code');
                    $('.line-' + code).addClass('highlight').each(function() {
                        this.parentNode.appendChild(this);
                    });
                });
            }
        });

        // 鼠标悬浮到线路上时高亮整条线路
        $('#g-box').on('mouseenter', '.subway-line', function() {
            if (highlightMode === 1 && !$(this).hasClass('dim')) {
                var lineCode = $(this).data('line');
                
                clearTimeout(highlightTimeout);
                
                if (currentHighlightLine !== lineCode) {
                    if (currentHighlightLine) {
                        $('.line-' + currentHighlightLine).removeClass('highlight');
                    }
                    currentHighlightLine = lineCode;
                    $('.line-' + lineCode).addClass('highlight').each(function() {
                        // 将高亮的线路置于顶层
                        this.parentNode.appendChild(this);
                    });
                }
            }
        }).on('mouseleave', '.subway-line', function() {
            if (highlightMode === 1) {
                highlightTimeout = setTimeout(function() {
                    if (currentHighlightLine) {
                        $('.line-' + currentHighlightLine).removeClass('highlight');
                        currentHighlightLine = null;
                    }
                }, 50);
            }
        });

        // 线路分析面板交互
        $('#btn-highlight').on('click', function(){
            // remove existing highlight
            $('.subway-line').removeClass('highlight');
            $('#line-controls input[type=checkbox]:checked').each(function(){
                var code = $(this).data('code');
                $('.line-' + code).each(function(){
                    $(this).addClass('highlight');
                    // bring to front
                    this.parentNode.appendChild(this);
                });
            });
        });

        $('#btn-reset').on('click', function(){
            $('.subway-line').removeClass('highlight dim');
            $('#line-controls input[type=checkbox]').prop('checked', true);
        });

        // Handle panel close
        $('#close-spacings-panel').on('click', function() {
            $('#spacings-panel').hide();
        });

        // Handle line clicks to show spacings
        $('#g-box').on('click', '.subway-line', function(e) {
            if (!$('#toggle-line-spacings').is(':checked')) return;

            var lcode = undefined;
            var classList = ($(this).attr('class') || '').split(/\s+/);
            for (var i = 0; i < classList.length; i++) {
                if (classList[i].indexOf('line-') === 0) {
                    lcode = classList[i].substring(5);
                    break;
                }
            }
            
            if (!lcode) return;

            var lineMeta = linesMeta.find(function(l) { return l.code == lcode; });
            if (!lineMeta) return;
            
            // Let's get the line element from BJ.data
            var lineElem = $(BJ.data).find("l[lcode='" + lcode + "']");
            if (lineElem.length === 0) {
                var lidx = linesMeta.indexOf(lineMeta);
                lineElem = $(BJ.data).find("sw").children().eq(lidx);
            }

            var lSlb = lineElem.attr('lb') || lineElem.attr('slb') || lineMeta.label;
            var cleanLineName = lSlb.replace(/,/g, '');

            // Prefer lookup by line name keys in spacings.json (original format)
            var spacingObj = null;
            var matchedKey = null;

            if (BJ.spacings) {
                // exact match first (use original lb/slb if possible)
                if (BJ.spacings[lSlb]) {
                    matchedKey = lSlb;
                    spacingObj = BJ.spacings[matchedKey];
                } else if (BJ.spacings[cleanLineName]) {
                    matchedKey = cleanLineName;
                    spacingObj = BJ.spacings[matchedKey];
                } else {
                    // try partial / alias matching
                    var spacingKeys = Object.keys(BJ.spacings || {});
                    for (var i = 0; i < spacingKeys.length; i++) {
                        var sk = spacingKeys[i];
                        if (sk.indexOf(cleanLineName) !== -1 || cleanLineName.indexOf(sk) !== -1 || 
                            sk.replace('线', '') === cleanLineName.replace('线', '')) {
                            matchedKey = sk;
                            spacingObj = BJ.spacings[sk];
                            break;
                        }
                    }
                    // try aliases split by comma
                    if (!matchedKey) {
                        var aliases = lSlb.split(',');
                        var spacingKeys2 = Object.keys(BJ.spacings || {});
                        for (var i = 0; i < spacingKeys2.length; i++) {
                            var sk = spacingKeys2[i];
                            for (var j = 0; j < aliases.length; j++) {
                                if (sk.indexOf(aliases[j]) !== -1 || aliases[j].indexOf(sk) !== -1) {
                                    matchedKey = sk;
                                    spacingObj = BJ.spacings[sk];
                                    break;
                                }
                            }
                            if (matchedKey) break;
                        }
                    }
                }
            }

            if (!matchedKey || !spacingObj) {
                alert('未找到该线路的站间距信息: ' + lSlb);
                return;
            }

            var isLoop = lineElem.attr('loop') === 'true';
            var stations = lineElem.children('p');

            // 尝试优先使用 spacing.json 中的站点顺序，只包含当前线路的站点
            var preferOrder = [];
            for (var pi = 0; pi < stations.length; pi++) {
                preferOrder.push($(stations[pi]).attr('lb'));
            }

            // 横向布局：使用 flex 横排，每段显示起止站和距离；长线路支持横向滚动
            var totalDist = 0;

            var stList = [];
            if (spacingObj) {
                stList = buildOrderedStations(spacingObj, isLoop, preferOrder);
            }
            // 如果 spacingObj 无法生成顺序（如缺数据），回退到 SVG 顺序
            if (!stList || stList.length === 0) {
                for(var i=0; i<stations.length; i++) {
                    stList.push($(stations[i]).attr('lb'));
                }
                if (isLoop && stList.length > 0) {
                    stList.push(stList[0]);
                }
            }

            // 构建横向段信息数组
            var segments = [];
            for(var i=0; i<stList.length - 1; i++) {
                var s1 = stList[i];
                var s2 = stList[i+1];
                var dist = 0;
                if (spacingObj && spacingObj[s1] && spacingObj[s1][s2]) {
                    dist = spacingObj[s1][s2];
                } else if (spacingObj && spacingObj[s2] && spacingObj[s2][s1]) {
                    dist = spacingObj[s2][s1];
                }
                totalDist += dist;
                segments.push({s1: s1, s2: s2, dist: dist});
            }

            var axisColor = (lineMeta && lineMeta.color) ? lineMeta.color : '#007bff';
            var html = '';
            // 时间轴布局：使用 CSS 类，颜色通过 CSS 变量传入
            html += '<div class="spacings-overflow" style="--axis-color:' + axisColor + ';">';
            html += '<div class="spacings-timeline">';

            // 先渲染第一个站点
            if (stList.length > 0) {
                var first = stList[0];
                html += '<div class="station-node">';
                html += '<div class="dot"></div>';
                html += '<div class="station-label">' + first + '</div>';
                html += '</div>';
            }

            for (var si = 0; si < segments.length; si++) {
                var seg = segments[si];
                // connector with distance
                html += '<div class="connector">';
                html += '<div class="bar"></div>';
                html += '<div class="distance">' + (seg.dist > 0 ? seg.dist + ' 米' : '--') + '</div>';
                html += '</div>';

                // next station node
                html += '<div class="station-node">';
                html += '<div class="dot"></div>';
                html += '<div class="station-label">' + seg.s2 + '</div>';
                html += '</div>';
            }

            html += '</div>'; // spacings-timeline
            html += '</div>'; // spacings-overflow
            html += '<div class="spacings-total">总计: ' + totalDist + ' 米</div>';

            // show human-friendly title (use line label if available)
            var titleLabel = (lineMeta && lineMeta.label) ? lineMeta.label : cleanLineName;
            $('#spacings-title').text(titleLabel + ' 站间距');
            $('#spacings-content').html(html);
            // 鼠标滚轮左右滚动支持：在 .spacings-overflow 上把 vertical wheel 转为 horizontal scroll
            var $overflow = $('#spacings-content').find('.spacings-overflow');
            $overflow.off('wheel.spacings').on('wheel.spacings', function(e){
                // 阻止页面垂直滚动
                e.preventDefault();
                var delta = e.originalEvent.deltaY || e.originalEvent.wheelDelta;
                // 调整速度因子，delta 为正向下滚动，需向右滚动
                this.scrollLeft += delta;
            });
            $('#spacings-panel').show();
        });

        // ---------------------------
        // 首末班车：加载 stations.xml 并在站点悬停时显示 tooltip
        // ---------------------------
        var stationInfoMap = {}; // name -> [ { firstend, linename, url }, ... ]

        // 动态创建 tooltip 容器（若不存在）
        if (!$('#station-tooltip').length) {
            $('body').append('<div id="station-tooltip" class="station-tooltip hidden"></div>');
        }

        // 异步加载 stations.xml（非阻塞）
        $.ajax({
            url: 'subwaymap/stations.xml',
            dataType: 'xml',
            type: 'GET',
            success: function(xml) {
                try {
                    $(xml).find('s').each(function() {
                        var $s = $(this);
                        var name = $s.attr('name');
                        if (!name) return;
                        var entry = {
                            firstend: $s.attr('firstend') || '',
                            linename: $s.attr('linename') || '',
                            url: $s.attr('url') || ''
                        };
                        if (!stationInfoMap[name]) stationInfoMap[name] = [];
                        stationInfoMap[name].push(entry);
                    });
                    console.log('首末班车信息已加载，站点名条目数：' + Object.keys(stationInfoMap).length);
                } catch (e) {
                    console.warn('解析 stations.xml 失败:', e);
                }
            },
            error: function() {
                console.warn('无法加载 subwaymap/stations.xml，首末班车功能将不可用');
            }
        });

        // 显示 tooltip 的辅助函数
        function renderStationTooltip(name) {
            var $tip = $('#station-tooltip');
            var infos = stationInfoMap[name];
            var html = '';
            html += '<div class="tooltip-title">' + (name || '') + '</div>';
            if (infos && infos.length) {
                infos.forEach(function(info) {
                    // show line name if present
                    if (info.linename) {
                        html += '<div class="tooltip-line"><strong>' + info.linename + '</strong></div>';
                    }
                    if (info.firstend) {
                        var parts = info.firstend.split('||||||');
                        parts.forEach(function(p) {
                            var seg = p.split('::::::');
                            var dir = (seg[1] || seg[0] || '').trim();
                            var times = (seg[2] || seg[1] || '').trim();
                            if (times) {
                                html += '<div class="tooltip-line"><strong>' + (dir || '方向') + '：</strong>' + times + '</div>';
                            }
                        });
                    } else {
                        html += '<div class="tooltip-line">无首末班信息</div>';
                    }
                    // separator between multiple entries
                    html += '<div style="height:6px"></div>';
                });
            } else {
                html += '<div class="tooltip-line">无首末班信息</div>';
            }
            $tip.html(html);
            return $tip;
        }

        // 事件代理：SVG 中的站点元素使用 sdata 属性保存站名
        var showTimer = null;
        $('#g-box').on('mouseenter', '.station-dot, image', function(e) {
            if (!$('#toggle-firstlast').is(':checked')) return;
            var name = $(this).attr('sdata') || $(this).attr('sdata') || $(this).attr('sdata');
            if (!name) return;
            clearTimeout(showTimer);
            showTimer = setTimeout(function() {
                var $tip = renderStationTooltip(name);
                // 使用鼠标位置进行定位，稍微偏移
                var pageX = e.pageX || (e.originalEvent && e.originalEvent.pageX) || 0;
                var pageY = e.pageY || (e.originalEvent && e.originalEvent.pageY) || 0;
                var left = pageX + 12;
                var top = pageY + 12;
                $tip.css({left: left + 'px', top: top + 'px'}).removeClass('hidden').show();
            }, 80);
        }).on('mouseleave', '.station-dot, image', function() {
            clearTimeout(showTimer);
            $('#station-tooltip').addClass('hidden').hide();
        });

        // 触摸/点击设备的回退：点击站点显示信息（需要切换开启）
        $('#g-box').on('click', '.station-dot, image', function(e) {
            if (!$('#toggle-firstlast').is(':checked')) return;
            var name = $(this).attr('sdata') || $(this).attr('sdata') || $(this).attr('sdata');
            if (!name) return;
            var $tip = renderStationTooltip(name);
            var pageX = e.pageX || (e.originalEvent && e.originalEvent.pageX) || 0;
            var pageY = e.pageY || (e.originalEvent && e.originalEvent.pageY) || 0;
            var left = pageX + 12;
            var top = pageY + 12;
            $tip.css({left: left + 'px', top: top + 'px'}).removeClass('hidden').show();
            // 自动在 4 秒后隐藏
            setTimeout(function(){ $('#station-tooltip').addClass('hidden').hide(); }, 4000);
        });

        // ---------- 按时间查询是否有车（按首末班判断） ----------
        function parseTimeToMinutes(t) {
            if (!t) return null;
            t = ('' + t).trim().replace('：', ':');
            var m = t.match(/(\d{1,2}):(\d{2})/);
            if (!m) return null;
            var hh = parseInt(m[1], 10);
            var mm = parseInt(m[2], 10);
            return hh * 60 + mm;
        }

        function extractFirstLastFromSegment(seg) {
            var timeRegex = /(\d{1,2}[:：]\d{2})/g;
            var first = null, last = null;
            try {
                var m1 = seg.match(/首车[^\d]*(\d{1,2}[:：]\d{2})/);
                if (m1 && m1[1]) first = parseTimeToMinutes(m1[1]);
                var m2 = seg.match(/末车[^\d]*(\d{1,2}[:：]\d{2})/);
                if (m2 && m2[1]) last = parseTimeToMinutes(m2[1]);
                // 如果未找到明确的首车/末车，退回到段内的第一个/最后一个时间
                if (!first || !last) {
                    var all = seg.match(timeRegex) || [];
                    if (!first && all.length >= 1) first = parseTimeToMinutes(all[0]);
                    if (!last && all.length >= 2) last = parseTimeToMinutes(all[all.length - 1]);
                }
            } catch (e) {
                return {first: first, last: last};
            }
            return {first: first, last: last};
        }

        function infoHasTrainAt(info, queryMin) {
            if (!info || !info.firstend) return false;
            var segments = info.firstend.split('||||||');
            for (var i = 0; i < segments.length; i++) {
                var seg = segments[i] || '';
                var fl = extractFirstLastFromSegment(seg);
                var f = fl.first, l = fl.last;
                if (f == null && l == null) continue;
                if (f != null && l != null) {
                    // crosses midnight?
                    if (l < f) {
                        if (queryMin >= f || queryMin <= l) return true;
                    } else {
                        if (queryMin >= f && queryMin <= l) return true;
                    }
                } else if (f != null && l == null) {
                    if (queryMin >= f) return true;
                } else if (f == null && l != null) {
                    if (queryMin <= l) return true;
                }
            }
            return false;
        }

        function stationHasTrainAt(name, queryMin) {
            var infos = stationInfoMap[name];
            if (!infos || infos.length === 0) return true; // 无数据则视为有车（不隐藏）
            for (var i = 0; i < infos.length; i++) {
                if (infoHasTrainAt(infos[i], queryMin)) return true;
            }
            return false;
        }

        function setStationVisibleByName(name, visible) {
            // elements that carry sdata attribute (circle/image)
            $('#g-box').find('[sdata="' + name + '"]').each(function() {
                if (visible) $(this).show(); else $(this).hide();
            });
            // text labels matching name
            $('#g-box').find('text').filter(function() { return $(this).text().trim() === name; }).each(function() {
                if (visible) $(this).show(); else $(this).hide();
            });
        }

        // Helper: apply filter given minutes
        function applyTimeFilter(queryMin) {
            var seen = {};
            $('#g-box').find('[sdata]').each(function() {
                var name = $(this).attr('sdata');
                if (!name) return;
                if (seen[name] !== undefined) return;
                seen[name] = true;
                var ok = stationHasTrainAt(name, queryMin);
                setStationVisibleByName(name, ok);
            });
        }

        // populate hour/minute selects
        (function populateTimeSelectors(){
            var $h = $('#hour-select');
            for (var hh = 0; hh < 24; hh++) {
                var txt = (hh < 10 ? '0' + hh : '' + hh);
                $h.append('<option value="' + hh + '">' + txt + '</option>');
            }
            var $m = $('#minute-select');
            for (var mm = 0; mm < 60; mm += 5) {
                var txt = (mm < 10 ? '0' + mm : '' + mm);
                $m.append('<option value="' + mm + '">' + txt + '</option>');
            }
        })();

        function getSelectedMinutes() {
            var hh = parseInt($('#hour-select').val(), 10) || 0;
            var mm = parseInt($('#minute-select').val(), 10) || 0;
            return hh * 60 + mm;
        }

        function setSelectedMinutes(totalMin) {
            totalMin = ((totalMin % 1440) + 1440) % 1440;
            var hh = Math.floor(totalMin / 60);
            var mm = totalMin % 60;
            $('#hour-select').val(hh);
            $('#minute-select').val(mm - (mm % 5));
        }

        // search using selects
        $('#btn-time-search').on('click', function() {
            var q = getSelectedMinutes();
            applyTimeFilter(q);
        });

        // change handlers trigger immediate filter
        $('#hour-select, #minute-select').on('change', function(){
            var q = getSelectedMinutes();
            applyTimeFilter(q);
        });

        var playTimer = null;
        function incrementByFive() {
            var cur = getSelectedMinutes();
            cur = (cur + 5) % 1440;
            setSelectedMinutes(cur);
            applyTimeFilter(cur);
        }

        $('#btn-time-play').on('click', function() {
            var $btn = $(this);
            var playing = $btn.attr('data-playing') === 'true';
            if (playing) {
                // stop
                clearInterval(playTimer); playTimer = null;
                $btn.attr('data-playing', 'false').text('播放');
            } else {
                // start
                playTimer = setInterval(incrementByFive, 1000);
                $btn.attr('data-playing', 'true').text('暂停');
            }
        });

        $('#btn-time-clear').on('click', function() {
            // stop playback
            if (playTimer) { clearInterval(playTimer); playTimer = null; $('#btn-time-play').attr('data-playing','false').text('播放'); }
            // show all elements
            $('#g-box').find('[sdata]').show();
            $('#g-box').find('text').show();
            // reset selects to 00:00
            setSelectedMinutes(0);
        });

    }
});
