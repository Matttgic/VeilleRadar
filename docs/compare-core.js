/* VeilleRadar: price comparison calculations; no fetched or invented prices. */
(function(root){
  'use strict';
  function price(value){
    if(typeof value==='number')return Number.isFinite(value)&&value>=0&&value<=100000?Math.round(value*100)/100:null;
    if(typeof value!=='string')return null;
    const raw=value.trim().replace(/\u00a0/g,' ').replace(/\s*€\s*$/,'').trim();
    if(!/^\d{1,6}(?:[,.]\d{1,2})?$/.test(raw))return null;
    const n=Number(raw.replace(',','.'));
    return Number.isFinite(n)&&n>=0&&n<=100000?Math.round(n*100)/100:null;
  }
  function publicUrl(text){
    if(typeof text!=='string'||text.length>2048)return null;
    try{
      const u=new URL(text.trim());
      if(!['https:','http:'].includes(u.protocol)||!u.hostname||u.username||u.password)return null;
      if(u.hostname==='localhost'||u.hostname.endsWith('.local'))return null;
      return u.toString();
    }catch{return null;}
  }
  function cleanOffer(raw){
    if(!raw||typeof raw!=='object')return null;
    const name=typeof raw.shop==='string'?raw.shop.trim().slice(0,80):'';
    const url=publicUrl(raw.url);
    const itemPrice=price(raw.price),shipping=price(raw.shipping===''?0:raw.shipping);
    if(!name||!url||itemPrice===null||itemPrice===0||shipping===null)return null;
    const quality=raw.quality===''||raw.quality===null||raw.quality===undefined?null:Number(raw.quality);
    if(quality!==null&&(!Number.isFinite(quality)||quality<1||quality>5))return null;
    const stamp=typeof raw.checkedAt==='string'&&Number.isFinite(Date.parse(raw.checkedAt))?raw.checkedAt:new Date().toISOString();
    return {id:typeof raw.id==='string'?raw.id.slice(0,80):'',shop:name,url,price:itemPrice,shipping,total:Math.round((itemPrice+shipping)*100)/100,quality,checkedAt:stamp};
  }
  function compare(rawOffers,qualityWeight){
    const list=(Array.isArray(rawOffers)?rawOffers:[]).map(cleanOffer).filter(Boolean).slice(0,30);
    list.sort((a,b)=>a.total-b.total||a.shop.localeCompare(b.shop,'fr'));
    const bestPrice=list[0]||null;
    const allRated=list.length>1&&list.every(o=>o.quality!==null);
    const weight=Number.isFinite(Number(qualityWeight))?Math.max(0,Math.min(1,Number(qualityWeight))):.35;
    let bestOverall=null;
    if(allRated){
      const cheapest=bestPrice.total;
      const scored=list.map(o=>({offer:o,score:(1-weight)*(cheapest/o.total)*100+weight*(o.quality/5)*100}));
      scored.sort((a,b)=>b.score-a.score||a.offer.total-b.offer.total);
      bestOverall=scored[0];
    }
    return {offers:list,bestPrice,bestOverall,allRated,weight};
  }
  function searchLinks(term){
    const query=typeof term==='string'?term.trim().slice(0,130):'';
    if(!query)return [];
    return [
      {name:'Google Shopping',url:'https://www.google.com/search?tbm=shop&q='+encodeURIComponent(query)},
      {name:'Idealo',url:'https://www.idealo.fr/resultats.html?q='+encodeURIComponent(query)},
      {name:'Dealabs',url:'https://www.dealabs.com/search?q='+encodeURIComponent(query)}
    ];
  }
  const api={price,publicUrl,cleanOffer,compare,searchLinks};
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.VeilleCompare=api;
})(typeof globalThis!=='undefined'?globalThis:this);
