var BJ = {
    data: "",
    startName: "",
    endName: "",
    type: 1
}
var linesMeta = [];
console.log('painter.js loaded');

// 定义 func 对象（如果还未定义）
if (typeof func === 'undefined') {
    var func = {
        isPC: function() {
            var userAgent = navigator.userAgent.toLowerCase();
            return !(userAgent.match(/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i));
        }
    };
}

// 等待 jQuery 加载完成
function initPainter() {
    console.log('initPainter called, checking jQuery...');
    
    if (typeof jQuery === 'undefined' || typeof $ === 'undefined') {
        console.error('jQuery not loaded, retrying...');
        setTimeout(initPainter, 100);
        return;
    }
    
    console.log('✓ jQuery loaded, initializing painter');
    
    if (!func.isPC()) {
        console.warn('Non-PC environment detected');
        alert("移动端部分功能无法体验，请在PC端查看")
    }
    
    // 构建 XML 文件路径 - 支持相对路径和 GitHub Pages
    var xmlPath = 'subwaymap/beijing.xml';
    console.log('Loading XML from:', xmlPath);
    
    $.ajax({
        url: xmlPath,
        dataType: 'xml',
        type: 'GET',
        async: false,
        timeout: 5000,
        success: function(data) {
            console.log('✓ XML data loaded successfully');
            BJ.data = data;
            var ls = $(data).find("sw").children()
        for (var i = 0; i < ls.length; i++) {
                var ps = $(ls[i]).children()
                var lColor = $(ls[i]).attr("lc").replace("0x", "#");
                var lLoop = $(ls[i]).attr("loop");
                var lSlb = $(ls[i]).attr("slb");
                var lcode = $(ls[i]).attr('lcode') || ('line' + i);
                var llabel = (lSlb || '').split(',')[0] || lcode;
                linesMeta.push({ code: lcode, label: llabel, color: lColor });
            for (var n = 0; n < $(ls[i]).attr("lp").split(";").length; n++) {
                if ($(ls[i]).attr("lp").split(";")[n]) {
                    var lp = $(ls[i]).attr("lp").split(";")[n].split(",");
                    var rect = $.svg('rect').appendTo('#g-box')
                    rect.attr({
                        x: lp[0] * 1,
                        y: lp[1] * 1,
                        width: lp[2] * 1,
                        height: lp[3] * 1,
                        fill: lColor,
                    });
                    var text = $.svg('text').appendTo('#g-box')
                    text.addSvgClass("subway-name").attr({
                        x: lp[0] * 1 + lp[2] / 2,
                        y: lp[1] * 1 + lp[3] / 3 * 2,
                    }).html(lSlb.split(",")[n].indexOf("机场") == -1 ? "地铁" + (isNaN(lSlb.split(",")[n] * 1) ? lSlb.split(",")[n] : lSlb.split(",")[n] + "号") + "线" : lSlb.split(",")[n] + "线");
                }
            }
            for (var j = 0; j < ps.length; j++) {
                if (j == ps.length - 1) {
                    if (lLoop === "false") {
                        continue;
                    }
                }
                var thisP = $(ps[j]);
                var thisPlus = (j == ps.length - 1) ? $(ps[0]) : $(ps[j + 1])
                if (thisP.attr("arc")) {
                    var path = $.svg('path').appendTo('#g-box')
                        path.attr({
                            d: `M${thisP.attr("x")*1} ${thisP.attr("y")*1} Q${thisP.attr("arc").split(":")[0]*1} ${thisP.attr("arc").split(":")[1]*1} ${thisPlus.attr("x")*1} ${thisPlus.attr("y")*1}`,
                            stroke: lColor,
                            'data-line': lcode,
                            'class': 'subway-line line-' + lcode
                        });
                    continue;
                }
                var line = $.svg('line').appendTo('#g-box')
                line.attr({
                    x1: thisP.attr("x") * 1,
                    y1: thisP.attr("y") * 1,
                    x2: thisPlus.attr("x") * 1,
                    y2: thisPlus.attr("y") * 1,
                    stroke: lColor,
                    'data-line': lcode,
                    'class': 'subway-line line-' + lcode
                })
            }
            for (var j = 0; j < ps.length; j++) {
                var thisP = $(ps[j])
                if (!thisP.attr("lb")) {
                    continue;
                }
                var text = $.svg('text').appendTo('#g-box')
                text.attr({
                    "font-size": 12,
                    x: thisP.attr("x") * 1 + thisP.attr("rx") * 1,
                    y: thisP.attr("y") * 1 + thisP.attr("ry") * 1 + 14,
                    size: 12
                })
                var tspan = $.svg('tspan').appendTo(text)
                tspan.html(thisP.attr("lb"))
                if (thisP.attr("iu") === "false") {
                    text.addSvgClass("disabled")
                    var text1 = $.svg('text').appendTo('#g-box')
                    text1.attr({
                        "font-size": 12,
                        x: thisP.attr("x") * 1 + thisP.attr("rx") * 1,
                        y: thisP.attr("y") * 1 + thisP.attr("ry") * 1 + 28,
                        size: 12
                    }).addSvgClass("disabled")
                    var tspan = $.svg('tspan').appendTo(text1)
                    tspan.html("(暂缓开通)")
                }
                if (thisP.attr("ex") === "true") {
                    var image = $.svg('image').appendTo('#g-box')
                    image.attr({
                        width: "14",
                        height: "14",
                        x: thisP.attr("x") - 7,
                        y: thisP.attr("y") - 7 + (thisP.attr("dy") ? thisP.attr("dy") * 1 : ""),
                        sdata: thisP.attr("lb")
                    });
                    image[0].href.baseVal = `subwaymap/turn.png`;
                } else {
                    var circle = $.svg('circle').appendTo('#g-box')
                    circle.attr({
                        r: 4,
                        cx: thisP.attr("x") * 1,
                        cy: thisP.attr("y") * 1,
                        stroke: lColor,
                        sdata: thisP.attr("lb")
                    })
                        .attr({ 'data-line': lcode, 'class': 'station-dot line-' + lcode })
                    if (thisP.attr("iu") === "false") {
                        circle.addSvgClass("disabled")
                    }
                }
            }
        }
        // compute bbox of drawn content and set viewBox so SVG scales correctly
        try{
            var svgEl = document.getElementById('mobile-svg');
            var gEl = document.getElementById('g-box');
            if(svgEl && gEl && typeof gEl.getBBox === 'function'){
                var bb = gEl.getBBox();
                var pad = Math.max(bb.width, bb.height) * 0.02 || 10;
                var vbX = bb.x - pad, vbY = bb.y - pad, vbW = bb.width + pad*2, vbH = bb.height + pad*2;
                if(vbW > 0 && vbH > 0){
                    svgEl.setAttribute('viewBox', vbX + ' ' + vbY + ' ' + vbW + ' ' + vbH);
                    svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
                    console.log('svg viewBox set to', svgEl.getAttribute('viewBox'));
                }
            }
        }catch(e){
            console.warn('设置 viewBox 失败', e);
        }

        // compute bbox of drawn content and set viewBox so SVG scales correctly
        try{
            var svgEl = document.getElementById('mobile-svg');
            var gEl = document.getElementById('g-box');
            if(svgEl && gEl && typeof gEl.getBBox === 'function'){
                var bb = gEl.getBBox();
                var pad = Math.max(bb.width, bb.height) * 0.02 || 10;
                var vbX = bb.x - pad, vbY = bb.y - pad, vbW = bb.width + pad*2, vbH = bb.height + pad*2;
                if(vbW > 0 && vbH > 0){
                    svgEl.setAttribute('viewBox', vbX + ' ' + vbY + ' ' + vbW + ' ' + vbH);
                    svgEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
                    console.log('svg viewBox set to', svgEl.getAttribute('viewBox'));
                }
            }
        }catch(e){
            console.warn('设置 viewBox 失败', e);
        }

        // 确保 Hammer 和 svgPanZoom 都已加载
        if (typeof svgPanZoom === 'undefined') {
            console.error('svgPanZoom is not loaded!');
            return;
        }
        
        if (typeof Hammer === 'undefined') {
            console.warn('Hammer.js is not loaded, touch gestures will not work');
        }

        try {
            console.log('Initializing svgPanZoom...');
            window.panzoom = svgPanZoom('#mobile-svg', {
                zoomEnabled: true,
                panEnabled: true,
                controlIconsEnabled: false,
                fit: false,
                center: false,
                contain: false,
                minZoom: 0.3,
                maxZoom: 5,
                customEventsHandler: eventsHandler
            });
            
            panzoom.pan({ x: -950 + window.innerWidth / 2, y: -700 + window.innerHeight / 2 });
            console.log('svgPanZoom initialized successfully');
        } catch(e) {
            console.error('Error initializing svgPanZoom:', e);
            console.error('Stack:', e.stack);
        }

        // build simple control panel for toggling/highlighting lines
        try{
            console.log('linesMeta length', linesMeta.length);
            var ctrl = $('<div id="line-controls" style="position:fixed;right:10px;top:10px;background:#fff;border:1px solid #ccc;padding:8px;max-height:80vh;overflow:auto;z-index:9999"></div>');
            ctrl.append('<strong>线路</strong><br/>');
            linesMeta.forEach(function(m){
                var id = 'chk-' + m.code;
                var row = $(`<label style="display:block;margin:4px 0"><input type="checkbox" checked data-code="${m.code}" id="${id}" /> ${m.label}</label>`);
                ctrl.append(row);
            });
            var btns = $('<div style="margin-top:6px"><button id="btn-highlight" style="margin-right:6px">高亮</button><button id="btn-reset">重置</button></div>');
            ctrl.append(btns);
            $('body').append(ctrl);

            // toggle visibility
            $('#line-controls input[type=checkbox]').on('change', function(){
                var code = $(this).data('code');
                var on = $(this).is(':checked');
                $('.line-' + code).each(function(){
                    var $el = $(this);
                    if(on){
                        $el.removeClass('dim');
                    }else{
                        $el.addClass('dim');
                    }
                });
            });

            // highlight selected checked lines
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
        }catch(e){console.warn(e)}
    },
    error: function(jqXHR, textStatus, errorThrown) {
        console.error('✗ Failed to load beijing.xml!');
        console.error('Status code:', jqXHR.status);
        console.error('Error type:', textStatus);
        console.error('Error thrown:', errorThrown);
        console.error('URL attempted:', 'subwaymap/beijing.xml');
        console.error('Current location:', window.location.href);
        
        if (jqXHR.status === 404) {
            console.error('The file was not found on the server');
            alert('错误：无法找到地图数据文件\n\n请确保：\n1. subwaymap/beijing.xml 文件存在\n2. 文件已上传到 GitHub');
        } else if (jqXHR.status === 0) {
            console.error('Network error - check CORS settings');
            alert('网络错误：无法访问地图数据\n请检查网络连接和跨域设置');
        } else {
            console.error('Response:', jqXHR.responseText);
            alert('无法加载地图数据: ' + textStatus + ' (HTTP ' + jqXHR.status + ')');
        }
        
        // 设置 linesMeta 长度为 0（供调试用）
        console.warn('linesMeta length after error: ' + linesMeta.length);
    }
    });
}

// 在 jQuery 完全加载后初始化
console.log('painter.js: Waiting for jQuery to load...');
var jQueryWaitAttempts = 0;
var maxAttempts = 50; // 最多等待 5 秒（50 * 100ms）

var jQueryCheckInterval = setInterval(function() {
    jQueryWaitAttempts++;
    
    if (typeof jQuery !== 'undefined' && typeof $ !== 'undefined') {
        console.log('painter.js: ✓ jQuery detected after ' + (jQueryWaitAttempts * 100) + 'ms');
        clearInterval(jQueryCheckInterval);
        // 再等一时刻确保 jQuery 完全初始化
        setTimeout(initPainter, 100);
    } else if (jQueryWaitAttempts >= maxAttempts) {
        console.error('painter.js: ✗ jQuery not loaded after 5 seconds!');
        console.error('此问题通常表示：');
        console.error('1. jQuery 文件加载失败（本地或 CDN）');
        console.error('2. 网络连接问题');
        console.error('3. 浏览器安全策略阻止');
        clearInterval(jQueryCheckInterval);
        alert('错误：jQuery 无法加载\n\n请尝试：\n1. 刷新页面\n2. 检查网络连接\n3. 如果问题持续，请报告此错误');
    }
}, 100);

// 其余的事件处理代码
/* Station interactivity removed: click/hover handlers and stations AJAX omitted */

$(".line-type").on("click", "li:not(.active)", function() {
    $(this).addClass("active").siblings().removeClass("active");
    BJ.type = $(this).attr("data-value")
    getThisLineInfo();
});
$(".line-info h2").on("click", "img", function() {
    [BJ.startName, BJ.endName] = [BJ.endName, BJ.startName]
    getThisLineInfo();
})

function getThisLineInfo() {
    $(".line-info h2 span").eq(0).html(BJ.startName);
    $(".line-info h2 span").eq(1).html(BJ.endName);
    $(".line-type li[data-value='" + BJ.type + "']").addClass("active").siblings().removeClass("active");
    $(".line-info article").remove();
    $.ajax({
        type: "get",
        url: `apis/api/searchstartend?start=${BJ.startName}&end=${BJ.endName}`,
        dataType: "json",
        contentType: "application/json; charset=utf-8",
        success(data) {
            if (data.result == "error") {
                alert(`抱歉，${BJ.startName}到${BJ.endName}无法换乘`);
                $(".mark").remove();
                return;
            }
            $(".line-info").show();
            $(".mark:not(rect)").remove();
            var timeReturnArr = [
                [],
                []
            ];
            for (var i = 0; i < JSON.parse(data.fangan).length; i++) {
                var thisTime = JSON.parse(data.fangan)[i]["m"] * 1;
                var thisReturn = JSON.parse(data.fangan)[i]["p"].length;
                timeReturnArr[0].push(thisTime)
                timeReturnArr[1].push(thisReturn)
            }
            var timeIndex = timeReturnArr[0].indexOf(timeReturnArr[0].min()),
                returnIndex;
            if (timeReturnArr[1][timeIndex] == timeReturnArr[1].min()) {
                returnIndex = timeIndex;
            } else {
                returnIndex = timeReturnArr[1].indexOf(timeReturnArr[1].min());
            }
            var firstPlan = BJ.type == 1 ? JSON.parse(data.fangan)[timeIndex] : JSON.parse(data.fangan)[returnIndex];
            var stationNum = 0;
            for (var i = 0; i < firstPlan["p"].length; i++) {
                stationNum += firstPlan["p"][i].length
            }
            $(".line-info p").html(`约${firstPlan.m}分钟• 途径${stationNum}站• 换乘${firstPlan["p"].length-1}次• 票价${data.price}元`)
            linePinter(firstPlan["p"])
        },
        error(data) {
            alert(data.responseJSON.message);
            isClick = false;
            $(".mark").remove();
            $(".line-info").hide();
        }
    })
}

function linePinter(firstPlan) {
    var thisLineStr = "";
    for (var i = 0; i < firstPlan.length; i++) {
        var lineCode = firstPlan[i][0][0];
        var thisLine = $(BJ.data).find("sw").find(`l[lcode='${lineCode}']`);
        var lColor = thisLine.attr("lc").replace("0x", "#");
        for (var j = 0; j < firstPlan[i].length - 1; j++) {
            var thisPNum = firstPlan[i][j][3] * 1;
            var thisPlusNum = firstPlan[i][j + 1][3] * 1;
            var ssN = [thisPNum, thisPlusNum];
            loopPinter(ssN, thisLine, lColor)
        }
        var thisLineNum = thisLine.attr("slb").split(",")[0]
        thisLineStr += `<article><h3>${thisLineNum.indexOf("机场") == -1 ? "地铁" + (isNaN(thisLineNum * 1) ? thisLineNum : thisLineNum + "号") + "线" : thisLineNum + "线"}</h3><ul>`;
        for (var j = 0; j < firstPlan[i].length; j++) {
            var thisP = thisLine.find(`p[n='${firstPlan[i][j][3]}']`)
            if (!thisP.attr("lb")) {
                continue;
            }
            thisLineStr += `<li>${firstPlan[i][j][1]}</li>`
            var text = $.svg('text').appendTo('#g-box')
            text.attr({
                "font-size": 12,
                x: thisP.attr("x") * 1 + thisP.attr("rx") * 1,
                y: thisP.attr("y") * 1 + thisP.attr("ry") * 1 + 14,
                size: 12
            }).addSvgClass("mark")
            var tspan = $.svg('tspan').appendTo(text)
            tspan.html(thisP.attr("lb"))
            if (thisP.attr("iu") === "false") {
                text.addSvgClass("disabled")
                var text1 = $.svg('text').appendTo('#g-box')
                text1.attr({
                    "font-size": 12,
                    x: thisP.attr("x") * 1 + thisP.attr("rx") * 1,
                    y: thisP.attr("y") * 1 + thisP.attr("ry") * 1 + 28,
                    size: 12
                }).addSvgClass("disabled")
                var tspan = $.svg('tspan').appendTo(text1)
                tspan.html("(暂缓开通)")
            }
            if (thisP.attr("ex") === "true") {
                var image = $.svg('image').appendTo('#g-box')
                image.attr({
                    width: "14",
                    height: "14",
                    x: thisP.attr("x") - 7,
                    y: thisP.attr("y") - 7 + (thisP.attr("dy") ? thisP.attr("dy") * 1 : ""),
                }).addSvgClass("mark");
                    image[0].href.baseVal = `subwaymap/turn.png`;
            } else {
                var circle = $.svg('circle').appendTo('#g-box')
                circle.attr({
                    r: 4,
                    cx: thisP.attr("x") * 1,
                    cy: thisP.attr("y") * 1,
                    stroke: lColor,
                }).addSvgClass("mark")
                if (thisP.attr("iu") === "false") {
                    circle.addSvgClass("disabled")
                }
            }
        }
        thisLineStr += `</ul></article>`
        var startPoint = $("[sdata='" + BJ.startName + "']")
        var startImg = $.svg('image').appendTo('#g-box');
        startImg.attr({
            width: 20,
            height: 31,
            x: startPoint[0].nodeName == "circle" ? startPoint.attr("cx") - 10 : (startPoint.attr("x") - 3),
            y: startPoint[0].nodeName == "circle" ? startPoint.attr("cy") - 28 : (startPoint.attr("y") - 21),
        }).addSvgClass("mark");
        startImg[0].href.baseVal = `subwaymap/start.png`;
        var endImg = $.svg('image').appendTo('#g-box');
        var endPoint = $("[sdata='" + BJ.endName + "']")
        endImg.attr({
            width: 20,
            height: 31,
            x: endPoint[0].nodeName == "circle" ? endPoint.attr("cx") - 10 : (endPoint.attr("x") - 3),
            y: endPoint[0].nodeName == "circle" ? endPoint.attr("cy") - 28 : (endPoint.attr("y") - 21),
        }).addSvgClass("mark");
        endImg[0].href.baseVal = `subwaymap/end.png`;
    }
    $(thisLineStr).appendTo(".line-info div")
}

function loopPinter(ssN, thisLine, lColor) {
    var isLoop = thisLine.attr("loop");
    if (isLoop === "true") {
        if ((ssN.max() - ssN.min()) > (thisLine.find("p").length - ssN.max() + ssN.min())) {
            for (var i = 0; i < ssN.min(); i++) {
                var thisP = thisLine.find(`p[n='${i}']`);
                var thisPlus = thisLine.find(`p[n='${i+1}']`);
                if (thisP.attr("arc")) {
                    var path = $.svg('path').appendTo('#g-box')
                    path.attr({
                        d: `M${thisP.attr("x")*1} ${thisP.attr("y")*1} Q${thisP.attr("arc").split(":")[0]*1} ${thisP.attr("arc").split(":")[1]*1} ${thisPlus.attr("x")*1} ${thisPlus.attr("y")*1}`,
                        stroke: lColor
                    }).addSvgClass("mark");
                    continue;
                }
                var line = $.svg('line').appendTo('#g-box')
                line.attr({
                    x1: thisP.attr("x") * 1,
                    y1: thisP.attr("y") * 1,
                    x2: thisPlus.attr("x") * 1,
                    y2: thisPlus.attr("y") * 1,
                    stroke: lColor
                }).addSvgClass("mark")
            }
            for (var i = ssN.max(); i < thisLine.find("p").length; i++) {
                var thisP = thisLine.find(`p[n='${i}']`);
                var thisPlus = thisLine.find(`p[n='${i+1 ==thisLine.find("p").length?0: i+1}']`);
                if (thisP.attr("arc")) {
                    var path = $.svg('path').appendTo('#g-box')
                    path.attr({
                        d: `M${thisP.attr("x")*1} ${thisP.attr("y")*1} Q${thisP.attr("arc").split(":")[0]*1} ${thisP.attr("arc").split(":")[1]*1} ${thisPlus.attr("x")*1} ${thisPlus.attr("y")*1}`,
                        stroke: lColor
                    }).addSvgClass("mark");
                    continue;
                }
                var line = $.svg('line').appendTo('#g-box')
                line.attr({
                    x1: thisP.attr("x") * 1,
                    y1: thisP.attr("y") * 1,
                    x2: thisPlus.attr("x") * 1,
                    y2: thisPlus.attr("y") * 1,
                    stroke: lColor
                }).addSvgClass("mark")
            }
        } else {
            for (var i = ssN.min(); i < ssN.max(); i++) {
                var thisP = thisLine.find(`p[n='${i}']`);
                var thisPlus = thisLine.find(`p[n='${i+1}']`);
                if (thisP.attr("arc")) {
                    var path = $.svg('path').appendTo('#g-box')
                    path.attr({
                        d: `M${thisP.attr("x")*1} ${thisP.attr("y")*1} Q${thisP.attr("arc").split(":")[0]*1} ${thisP.attr("arc").split(":")[1]*1} ${thisPlus.attr("x")*1} ${thisPlus.attr("y")*1}`,
                        stroke: lColor
                    }).addSvgClass("mark");
                    continue;
                }
                var line = $.svg('line').appendTo('#g-box')
                line.attr({
                    x1: thisP.attr("x") * 1,
                    y1: thisP.attr("y") * 1,
                    x2: thisPlus.attr("x") * 1,
                    y2: thisPlus.attr("y") * 1,
                    stroke: lColor
                }).addSvgClass("mark")
            }
        }
    } else {
        for (var i = ssN.min(); i < ssN.max(); i++) {
            var thisP = thisLine.find(`p[n='${i}']`);
            var thisPlus = thisLine.find(`p[n='${i+1}']`);
            if (thisP.attr("arc")) {
                var path = $.svg('path').appendTo('#g-box')
                path.attr({
                    d: `M${thisP.attr("x")*1} ${thisP.attr("y")*1} Q${thisP.attr("arc").split(":")[0]*1} ${thisP.attr("arc").split(":")[1]*1} ${thisPlus.attr("x")*1} ${thisPlus.attr("y")*1}`,
                    stroke: lColor
                }).addSvgClass("mark");
                continue;
            }
            var line = $.svg('line').appendTo('#g-box')
            line.attr({
                x1: thisP.attr("x") * 1,
                y1: thisP.attr("y") * 1,
                x2: thisPlus.attr("x") * 1,
                y2: thisPlus.attr("y") * 1,
                stroke: lColor,
            }).addSvgClass("mark")
        }
    }
}
var eventsHandler = {
    haltEventListeners: ['touchstart', 'touchend', 'touchmove', 'touchleave', 'touchcancel'],
    init: function(options) {
        console.log('Initializing eventsHandler...');
        
        if (typeof Hammer === 'undefined') {
            console.error('Hammer.js is not available!');
            return;
        }
        
        var instance = options.instance;
        var initialScale = 1;
        var pannedX = 0;
        var pannedY = 0;
        var self = this;
        
        try {
            // 创建 Hammer 实例（支持 Hammer 2.x）
            this.hammer = new Hammer(options.svgElement);
            console.log('Hammer instance created');
            
            // 尝试配置手势识别器
            try {
                // 方式1: 直接获取并配置（Hammer 2.x）
                var pinch = this.hammer.get('pinch');
                if (pinch && typeof pinch.set === 'function') {
                    pinch.set({ enable: true });
                    console.log('Pinch recognizer configured');
                }
                
                var pan = this.hammer.get('pan');
                if (pan && typeof pan.set === 'function') {
                    pan.set({ enable: true, direction: Hammer.DIRECTION_ALL });
                    console.log('Pan recognizer configured');
                }
            } catch(e) {
                console.warn('Could not configure recognizers via get/set:', e.message);
                // 继续执行，方式2 的事件拦截仍可用
            }
        } catch(e) {
            console.error('Error creating Hammer instance:', e);
            return;
        }
        
        // 绑定事件处理
        try {
            this.hammer.on('doubletap', function(ev) {
                console.log('Double tap detected');
                instance.zoomIn();
            });
            
            this.hammer.on('panstart panmove', function(ev) {
                if (ev.type === 'panstart') {
                    pannedX = 0;
                    pannedY = 0;
                }
                instance.panBy({
                    x: ev.deltaX - pannedX,
                    y: ev.deltaY - pannedY
                });
                pannedX = ev.deltaX;
                pannedY = ev.deltaY;
            });
            
            this.hammer.on('pinchstart pinchmove', function(ev) {
                if (ev.type === 'pinchstart') {
                    initialScale = instance.getZoom();
                }
                instance.zoomAtPoint(initialScale * ev.scale, {
                    x: ev.center.x,
                    y: ev.center.y
                });
            });
            
            console.log('Event handlers attached successfully');
        } catch(e) {
            console.error('Error attaching event handlers:', e);
        }
        
        // 阻止默认触摸行为
        options.svgElement.addEventListener('touchmove', function(e) {
            e.preventDefault();
        });
    },
    destroy: function() {
        if (this.hammer && typeof this.hammer.destroy === 'function') {
            try {
                this.hammer.destroy();
                console.log('Hammer instance destroyed');
            } catch(e) {
                console.warn('Error destroying Hammer instance:', e);
            }
        }
    }
}