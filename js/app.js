$(function(){
  var svg = document.getElementById('mapSvg');
  var viewport = document.getElementById('viewport');

  function hexFrom0x(s){ return (s||'0x000000').replace(/^0x/,'#'); }

  // Try to load XML with fetch first (works on GitHub Pages); fallback to jQuery.ajax if needed
  function loadXml(path, cb, errCb){
    if(window.fetch){
      fetch(path).then(function(res){
        if(!res.ok) throw new Error('Network response was not ok');
        return res.text();
      }).then(function(txt){
        var parser = new DOMParser();
        var xml = parser.parseFromString(txt, 'application/xml');
        cb(xml);
      }).catch(function(e){
        if(window.jQuery){
          $.ajax({url:path,dataType:'xml',success:cb,error:errCb});
        }else{
          errCb && errCb(e);
        }
      });
    }else if(window.jQuery){
      $.ajax({url:path,dataType:'xml',success:cb,error:errCb});
    }else{
      errCb && errCb(new Error('No fetch or jQuery available'));
    }
  }

  loadXml('subwaymap/beijing.xml', function(data){
    var $xml = $(data);
    // draw lines
    $xml.find('l').each(function(){
      var $l = $(this);
      var lc = hexFrom0x($l.attr('lc'));
      var pts = [];
      $l.find('p').each(function(){
        var x = $(this).attr('x');
        var y = $(this).attr('y');
        if(x&&y) pts.push([+x,+y,$(this).attr('lb')||'']);
      });
      if(pts.length){
        var d = 'M'+pts[0][0]+' '+pts[0][1];
        for(var i=1;i<pts.length;i++) d += ' L'+pts[i][0]+' '+pts[i][1];
        var path = document.createElementNS('http://www.w3.org/2000/svg','path');
        path.setAttribute('d',d);
        path.setAttribute('stroke',lc);
        path.setAttribute('stroke-width','8');
        path.setAttribute('fill','none');
        path.setAttribute('stroke-linecap','round');
        path.setAttribute('stroke-linejoin','round');
        viewport.appendChild(path);
      }
      // stations
      $l.find('p').each(function(){
        var x = $(this).attr('x');
        var y = $(this).attr('y');
        var lb = $(this).attr('lb')||'';
        if(x&&y){
          var c = document.createElementNS('http://www.w3.org/2000/svg','circle');
          c.setAttribute('cx',x); c.setAttribute('cy',y); c.setAttribute('r',4);
          c.setAttribute('fill','#fff'); c.setAttribute('stroke','#222'); c.setAttribute('stroke-width','1');
          viewport.appendChild(c);
          if(lb){
            var t = document.createElementNS('http://www.w3.org/2000/svg','text');
            t.setAttribute('x',+x+6); t.setAttribute('y',+y-6); t.setAttribute('fill','#111'); t.setAttribute('font-size','12');
            t.textContent = lb;
            viewport.appendChild(t);
          }
        }
      });
    });

    // compute bbox of drawn content and set viewBox so svg-pan-zoom can fit/center reliably
    try{
      var bb = viewport.getBBox();
      var pad = Math.max(bb.width, bb.height) * 0.03;
      var vbX = bb.x - pad, vbY = bb.y - pad, vbW = bb.width + pad*2, vbH = bb.height + pad*2;
      if(!isNaN(vbX) && isFinite(vbW) && vbW>0 && vbH>0){
        svg.setAttribute('viewBox', vbX + ' ' + vbY + ' ' + vbW + ' ' + vbH);
      }
    }catch(e){console.warn('计算 viewBox 失败',e)}

    // initialize pan/zoom
    try{
      svgPanZoom('#mapSvg',{
        controlIconsEnabled:true,
        zoomScaleSensitivity:0.2,
        fit:true,
        center:true
      });
    }catch(e){console.warn(e)}
  }, function(err){
    alert('无法加载 subwaymap/beijing.xml：' + (err && err.message || err));
  });
});
