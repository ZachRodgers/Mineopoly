// script.js  (UTF-8; safe escapes)
(function () {
  var LS_KEY = "monopoly_cmd_rows_v3";

  // Small-caps map
  var map = {a:"ᴀ",b:"ʙ",c:"ᴄ",d:"ᴅ",e:"ᴇ",f:"ꜰ",g:"ɢ",h:"ʜ",i:"ɪ",j:"ᴊ",k:"ᴋ",l:"ʟ",m:"ᴍ",n:"ɴ",o:"ᴏ",p:"ᴘ",q:"ǫ",r:"ʀ",s:"ꜱ",t:"ᴛ",u:"ᴜ",v:"ᴠ",w:"ᴡ",x:"x",y:"ʏ",z:"ᴢ",
             A:"ᴀ",B:"ʙ",C:"ᴄ",D:"ᴅ",E:"ᴇ",F:"ꜰ",G:"ɢ",H:"ʜ",I:"ɪ",J:"ᴊ",K:"ᴋ",L:"ʟ",M:"ᴍ",N:"ɴ",O:"ᴏ",P:"ᴘ",Q:"ǫ",R:"ʀ",S:"ꜱ",T:"ᴛ",U:"ᴜ",V:"ᴠ",W:"ᴡ",X:"x",Y:"ʏ",Z:"ᴢ"};

  function toSmall(s){ return String(s||"").split("").map(function(ch){ return map[ch] || ch; }).join(""); }

  function parseNum(s){
    if (s===undefined || s===null || s==="") return null;
    var n = Number(s);
    return isFinite(n) ? n : null;
  }

  // icons via escapes to avoid encoding issues
  var ICON_STACK = "\uD83D\uDEE2"; // 🛢
  var ICON_ITEM  = "\u23E3";       // ⏣
  var ICON_HOUSE = "\u2302";       // ⌂

  function toStacksItems(n){
    var stacks = Math.floor(n/64);
    var items  = Math.floor(n%64);
    var parts = [];
    if (stacks>0) parts.push(String(stacks)+ICON_STACK);
    if (items>0 || stacks===0) parts.push(String(items)+ICON_ITEM);
    return parts.join(" ");
  }
  function fmt(s){
    var n = parseNum(s);
    return n==null ? String(s||"").trim() : toStacksItems(n);
  }

  function defaultRow(){
    return {
      name:"",
      titleColor:"#FFFF00",
      vals:{ price:"", rent:"", rentFull:"", rent1:"", rent2:"", rent3:"", rent4:"", rentHotel:"", houseHotelCost:"", mortgage:"" },
      auto:{ rentFull:true, mortgage:true }
    };
  }

  // DOM
  var rowsEl    = document.getElementById("rows");
  var tpl       = document.getElementById("row-template");
  var toolbar   = document.querySelector(".toolbar");
  var addBtn      = document.getElementById("addRow");
  var setDefaultsBtn = document.getElementById("setDefaults");
  var resetBtn    = document.getElementById("reset");
  var copyBtn     = document.getElementById("copy");
  // container for additional copy buttons (created dynamically)
  var dynamicCopyButtons = [];
  

  // State
  var rows = load();

  function render(){
    rowsEl.innerHTML = "";
    for (var i=0;i<rows.length;i++){
      rowsEl.appendChild(renderRow(rows[i], i));
    }
    updateCopyState();
    save();
  }

  function renderRow(row, idx){
    var frag = tpl.content.cloneNode(true);
    var root = frag.querySelector(".row");

    var nameInput   = root.querySelector(".nameInput");
    var colorPicker = root.querySelector(".colorPicker");
    var colorHex    = root.querySelector(".colorHex");
    
    // Add red asterisk to Name label for rows 17+
    if (idx >= 16) {
      var nameLabel = root.querySelector(".field.name label");
      nameLabel.innerHTML = '<span style="color: red">*</span> Name';
    }

    var keys = ["price","rent","rentFull","rent1","rent2","rent3","rent4","rentHotel","houseHotelCost","mortgage"];
    var fields = {};
    for (var j=0;j<keys.length;j++){
      var k = keys[j];
      fields[k] = root.querySelector("."+k);
    }

    // set values
    nameInput.value = row.name;
    colorPicker.value = row.titleColor;
    colorHex.value = row.titleColor;
    for (var k2 in fields){
      if (fields.hasOwnProperty(k2)) fields[k2].value = row.vals[k2] || "";
    }

    // events
    nameInput.addEventListener("input", function(e){
      // keep transformed value in the same input so focus isn't lost
      var small = toSmall(e.target.value);
      e.target.value = small;
      rows[idx].name = small;
      // persist and update copy button state without re-rendering
      save();
      updateCopyState();
    });

    colorPicker.addEventListener("input", function(e){
      var v = String(e.target.value||"").toUpperCase();
      rows[idx].titleColor = v;
      // sync the other DOM control directly to avoid replacing nodes
      colorHex.value = v;
      save();
      updateCopyState();
    });

    colorHex.addEventListener("input", function(e){
      var v = String(e.target.value||"").toUpperCase();
      if (v.charAt(0) !== "#") {
        v = "#" + v.replace(/[^0-9A-F]/gi,"").slice(0,6);
      }
      rows[idx].titleColor = v;
      colorPicker.value = v;
      save();
      updateCopyState();
    });

    for (var k3 in fields){
      if (!fields.hasOwnProperty(k3)) continue;
      (function(k){
        fields[k].addEventListener("input", function(e){
          // sanitize to digits only
          var val = String(e.target.value).replace(/[^0-9]/g,"");
          e.target.value = val;
          rows[idx].vals[k] = val;

          // autos: update related DOM fields directly to avoid full re-render
          if (k === "price" && rows[idx].auto.mortgage){
            var pn = parseNum(val);
            rows[idx].vals.mortgage = pn==null ? "" : String(Math.round(pn/2));
            if (fields.mortgage) fields.mortgage.value = rows[idx].vals.mortgage;
          }
          if (k === "rent" && rows[idx].auto.rentFull){
            var rn = parseNum(val);
            rows[idx].vals.rentFull = rn==null ? "" : String(Math.round(rn*2));
            if (fields.rentFull) fields.rentFull.value = rows[idx].vals.rentFull;
          }
          if (k === "mortgage") rows[idx].auto.mortgage = false;
          if (k === "rentFull") rows[idx].auto.rentFull = false;

          save();
          updateCopyState();
        });
      })(k3);
    }

    // remove
    var rm = root.querySelector(".remove");
    rm.addEventListener("click", function(){
      rows.splice(idx,1);
      if (rows.length===0) rows.push(defaultRow());
      render();
    });

    return root;
  }

  // Load defaults from JSON
  function loadDefaults() {
    return fetch('defaults.json', {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      cache: 'no-store'
    })
      .then(response => {
        if (!response.ok) throw new Error('Failed to load defaults');
        return response.json();
      })
      .then(data => {
        console.log('Loaded defaults:', data); // Debug log
        return data.properties;
      })
      .catch(err => {
        console.error('Error loading defaults:', err);
        return null;
      });
  }

  function hasContent() {
    return rows.some(function(row) {
      return row.name || Object.values(row.vals).some(v => v);
    });
  }

  function updateDefaultsButtonState() {
    setDefaultsBtn.disabled = hasContent();
  }

  // Toolbar
  addBtn.addEventListener("click", function(){
    rows.push(defaultRow());
    render();
  });

  // Version selector removed; always use newest syntax when not explicitly passing 'legacy'

  setDefaultsBtn.addEventListener("click", function(){
    loadDefaults().then(function(defaults) {
      if (!defaults) return;
      rows = defaults.map(function(def) {
        return {
          name: toSmall(def.name), // Convert name to small caps
          titleColor: def.titleColor,
          vals: def.vals,
          auto: { rentFull: false, mortgage: false }
        };
      });
      render();
    });
  });

  resetBtn.addEventListener("click", function(){
    rows = [defaultRow()];
    save(true);
    render();
  });

  // copy button(s) behavior: chunked by 16 rows per command
  copyBtn.addEventListener("click", function(){
    if (copyBtn.disabled) return;
    var slice = rows.slice(0, 16);
    var cmd = buildShulker(slice);
    navigator.clipboard.writeText(cmd).then(function(){}, function(){});
    copyBtn.classList.add("copied");
    setTimeout(function(){ copyBtn.classList.remove("copied"); }, 900);
  });

  function chunkReady(chunkIndex){
    var start = chunkIndex * 16;
    var end = Math.min(rows.length, start + 16);
    if (start>=end) return false;
    for (var i=start;i<end;i++){
      var r = rows[i];
      if (!r.name || !r.name.trim()) return false;
      for (var k in r.vals){ if (!String(r.vals[k]||"").trim()) return false; }
    }
    return true;
  }

  function renderCopyButtons(){
    // number of chunks
    var chunks = Math.ceil(rows.length/16) || 1;

    // ensure dynamicCopyButtons array length equals chunks-1 (we keep primary copyBtn as chunk 1)
    // remove extra buttons if any
    for (var i = dynamicCopyButtons.length - 1; i >= 0; i--) {
      var btn = dynamicCopyButtons[i];
      var idx = i+2; // button corresponds to chunk idx
      if (idx > chunks) {
        btn.parentNode.removeChild(btn);
        dynamicCopyButtons.splice(i,1);
      }
    }

    // update primary copyBtn (chunk 1)
    var ready0 = chunkReady(0);
    copyBtn.disabled = !ready0;
    if (ready0) copyBtn.classList.add('ready'); else copyBtn.classList.remove('ready');
    // relabel
    var span = copyBtn.querySelector('span');
    if (span) span.textContent = 'Copy Command 1';

    // create or update remaining chunk buttons
    for (var ci=1; ci<chunks; ci++){
      (function(chunkIndex){
        var id = 'copy-'+(chunkIndex+1);
        var existing = document.getElementById(id);
        if (!existing){
          var b = document.createElement('button');
          b.id = id;
          b.className = 'btn copy chunk';
          b.innerHTML = copyBtn.innerHTML; // copy the svg and span from the first button
          // update the original span to the new one
          var span = b.querySelector('span');
          if (span) span.textContent = 'Copy Command ' + (chunkIndex+1);
          // insert after the last copy-related button
          toolbar.appendChild(b);
          dynamicCopyButtons.push(b);
          b.addEventListener('click', function(){
            if (b.disabled) return;
            var start = chunkIndex*16;
            var slice = rows.slice(start, start+16);
            var cmd = buildShulker(slice);
            navigator.clipboard.writeText(cmd).then(function(){}, function(){});
            b.classList.add('copied');
            setTimeout(function(){ b.classList.remove('copied'); }, 900);
          });
        }
      })(ci);
    }

    // update state for existing dynamic buttons
    for (var j=0;j<dynamicCopyButtons.length;j++){
      var btn = dynamicCopyButtons[j];
      var idx = j+1; // dynamic index maps to chunkIndex = idx
      var ready = chunkReady(idx);
      btn.disabled = !ready;
      if (ready) btn.classList.add('ready'); else btn.classList.remove('ready');
    }
  }

  // Helpers
  function allFilled(){
    if (rows.length===0) return false;
    for (var i=0;i<rows.length;i++){
      var r = rows[i];
      if (!r.name || !r.name.trim()) return false;
      for (var k in r.vals){
        if (!String(r.vals[k]||"").trim()) return false;
      }
    }
    return true;
  }
  function updateCopyState(){
    renderCopyButtons();
    updateDefaultsButtonState();
  }

  function save(clear){
    try{
      if (clear) localStorage.removeItem(LS_KEY);
      else localStorage.setItem(LS_KEY, JSON.stringify(rows));
    }catch(e){}
  }
  function load(){
    try{
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return [defaultRow()];
      var arr = JSON.parse(raw);
      return (arr && arr.length) ? arr : [defaultRow()];
    }catch(e){
      return [defaultRow()];
    }
  }

  // Command builder
  function buildItem(r, version){
    var F = fmt;
    var lore = [
      '["",{"text":"-= ","italic":false,"color":"white"},{"text":"'+F(r.vals.price)+'","italic":false,"color":"gold"},{"text":" =-","italic":false,"color":"white"}]',
      '[""]',
      '["",{"text":"Rent: ","italic":false,"color":"white"},{"text":"'+F(r.vals.rent)+'","italic":false,"color":"gold"}]',
      '["",{"text":"Rent with full set: ","italic":false,"color":"white"},{"text":"'+F(r.vals.rentFull)+'","italic":false,"color":"gold"}]',
      '["",{"text":"Rent with ","italic":false,"color":"white"},{"text":"1 House","italic":false,"color":"green"},{"text":": ","italic":false,"color":"white"},{"text":"'+F(r.vals.rent1)+'","italic":false,"color":"gold"}]',
      '["",{"text":"Rent with ","italic":false,"color":"white"},{"text":"2 Houses","italic":false,"color":"green"},{"text":": ","italic":false,"color":"white"},{"text":"'+F(r.vals.rent2)+'","italic":false,"color":"gold"}]',
      '["",{"text":"Rent with ","italic":false,"color":"white"},{"text":"3 Houses","italic":false,"color":"green"},{"text":": ","italic":false,"color":"white"},{"text":"'+F(r.vals.rent3)+'","italic":false,"color":"gold"}]',
      '["",{"text":"Rent with ","italic":false,"color":"white"},{"text":"4 Houses","italic":false,"color":"green"},{"text":": ","italic":false,"color":"white"},{"text":"'+F(r.vals.rent4)+'","italic":false,"color":"gold"}]',
      '["",{"text":"Rent with a ","italic":false,"color":"white"},{"text":"Hotel","italic":false,"color":"red"},{"text":": ","italic":false,"color":"white"},{"text":"'+F(r.vals.rentHotel)+'","italic":false,"color":"gold"}]',
      '[""]',
      '["",{"text":"House","italic":false,"color":"green"},{"text":" / ","italic":false,"color":"white"},{"text":"Hotel","italic":false,"color":"red"},{"text":" Cost: ","italic":false,"color":"white"},{"text":"'+F(r.vals.houseHotelCost)+'","italic":false,"color":"gold"}]',
      '[""]',
      '["",{"text":"Mortgage Value: ","italic":false,"color":"white"},{"text":"'+F(r.vals.mortgage)+'","italic":false,"color":"gold"}]',
      '["",{"text":"Unmortgage Cost: ","italic":false,"color":"white"},{"text":"'+fmt(Math.round(Number(r.vals.mortgage||0)*1.1))+'","italic":false,"color":"gold"}]'
    ];
    var customName = '["",{"text":"'+r.name+'","bold":true,"italic":false,"color":"'+r.titleColor+'"}]';
    
    if (version === 'legacy') {
      // Legacy syntax (<=1.21.4): produce NBT suitable for BlockEntityTag.Items entries
      // Name must be a JSON string and each Lore entry must be a JSON string in the list.
      var nameComponent = JSON.stringify(["", { text: r.name, bold: true, italic: false, color: r.titleColor }]);
      // Escape backslashes and double quotes so the JSON string can live inside an NBT string literal
      var escapedName = nameComponent.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
      var loreStrings = lore.map(function(x){
        var esc = x.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
        return '"' + esc + '"';
      }).join(',');
      // Return inner NBT (no outer braces) so callers can prepend Slot:.. when building Items
      return 'id:"minecraft:paper",Count:1b,tag:{display:{Name:"' + escapedName + '",Lore:['+loreStrings+']}}';
    }
    // New syntax (1.21.5+) - uses components wrapper
    return '{id:paper,count:1,components:{custom_name:'+customName+',lore:['+lore.join(",")+']}}';
  }

  function buildShulker(rowsArr, version){
    version = version || 'new';
    var slots = rowsArr.map(function(r,i){ return '{slot:'+i+',item:'+buildItem(r, version)+'}'; }).join(",");
    if (version === 'legacy') {
      // legacy syntax (<=1.21.4): construct BlockEntityTag.Items list
      var items = rowsArr.map(function(r,i){ return '{Slot:'+i+'b,'+buildItem(r,'legacy')+'}'; }).join(',');
      // Legacy /give syntax: /give <targets> <item> <count> <nbt>
      // Place the count before the NBT and use the namespaced item id to be explicit.
      return '/give @a minecraft:shulker_box 1 {BlockEntityTag:{Items:[' + items + ']}}';
    }
    // default/new syntax (1.21.5+)
    return '/give @p shulker_box[container=[' + slots + ']] 1';
  }

  // boot
  render();
  // Quick debug output when URL contains ?dbg - prints both syntaxes for the current rows
  if (typeof window !== 'undefined' && window.location && window.location.search.indexOf('dbg') > -1) {
    try{
      console.log('DEBUG (new syntax):', buildShulker(rows.slice(0,16), 'new'));
      console.log('DEBUG (legacy syntax):', buildShulker(rows.slice(0,16), 'legacy'));
    }catch(e){ console.error('Debug build error', e); }
  }
})();
