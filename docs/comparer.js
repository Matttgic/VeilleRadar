/* Client-only prototype. No backend, no automated monitoring of user offers. */
(function(){
'use strict';
const C=window.VeilleCompare;
const $=id=>document.getElementById(id);
const KEY='veilleradar-comparateur-v1';
const euro=v=>Number(v).toLocaleString('fr-FR',{style:'currency',currency:'EUR'});
let data={product:'',offers:[],weight:35};
try{
 const saved=JSON.parse(localStorage.getItem(KEY)||'{}');
 if(saved&&typeof saved.product==='string'&&Array.isArray(saved.offers)){
  data.product=saved.product.slice(0,130);
  data.offers=saved.offers.map(C.cleanOffer).filter(Boolean).slice(0,30);
  data.weight=Number.isFinite(Number(saved.weight))?Math.max(0,Math.min(100,Number(saved.weight))):35;
 }
}catch{}
function save(){
 try{localStorage.setItem(KEY,JSON.stringify(data));}catch{}
}
const el=(tag,cls,text)=>{
 const node=document.createElement(tag);
 if(cls)node.className=cls;
 if(text!==undefined)node.textContent=text;
 return node;
};
function search(){
 const query=$('product').value.trim();
 if(!query){$('search-links').replaceChildren(el('p','muted','Indiquez un produit pour rechercher des offres.'));return;}
 if(query!==data.product&&data.offers.length){
  if(!window.confirm('Changer de produit effacera les offres du précédent. Continuer ?'))return;
  data.offers=[];
 }
 data.product=query;save();
 const container=$('search-links');container.replaceChildren();
 C.searchLinks(query).forEach(link=>{
  const a=el('a','',link.name+' ↗');
  a.href=link.url;a.target='_blank';a.rel='noopener noreferrer';
  container.append(a);
 });
 render();
}
function render(){
 const result=C.compare(data.offers,data.weight/100);
 $('offers').replaceChildren();
 $('best-price').textContent=result.bestPrice?euro(result.bestPrice.total):'—';
 $('best-shop').textContent=result.bestPrice?result.bestPrice.shop+' · '+result.offers.length+' offre(s)':'Aucune offre ajoutée';
 $('best-overall').textContent=result.bestOverall?result.bestOverall.offer.shop:'—';
 $('overall-note').textContent=result.bestOverall?'Score de '+result.bestOverall.score.toFixed(1)+'/100 selon vos notes':'Notes nécessaires sur chaque offre';
 $('quality-row').style.display=result.allRated?'block':'none';
 $('quality-weight').value=String(data.weight);
 $('quality-weight-label').textContent=data.weight+' %';
 if(!result.offers.length){
  $('offers').append(el('div','empty','Aucune offre. Recherchez un produit, puis ajoutez deux ou trois prix vérifiés.'));
  return;
 }
 result.offers.forEach((offer,index)=>{
  const box=el('article','offer'+(index===0?' top':''));
  const head=el('div','offerhead');
  head.append(el('h3','',offer.shop));
  if(index===0)head.append(el('span','chip','PRIX LE PLUS BAS'));
  box.append(head);
  box.append(el('div','price',euro(offer.total)));
  box.append(el('p','',euro(offer.price)+' + '+euro(offer.shipping)+' de livraison'));
  box.append(el('p','',offer.quality===null?'Qualité non évaluée':'Votre note : '+offer.quality+'/5'));
  const t=new Date(offer.checkedAt);
  box.append(el('p','',Number.isFinite(t.getTime())?'Saisi le '+t.toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'}):'Date non vérifiée'));
  const links=el('div','links');
  const link=el('a','','Voir l’offre ↗');link.href=offer.url;link.target='_blank';link.rel='noopener noreferrer nofollow';
  const remove=el('button','','Retirer');remove.type='button';
  remove.addEventListener('click',()=>{
   data.offers=data.offers.filter(o=>o.id!==offer.id);save();render();
  });
  links.append(link,remove);box.append(links);$('offers').append(box);
 });
}
$('product').value=data.product;
$('find-links').addEventListener('click',search);
$('fill-example').addEventListener('click',()=>{
 $('product').value='casque Bluetooth à réduction de bruit';
 search();
});
$('product').addEventListener('keydown',e=>{
 if(e.key==='Enter'){e.preventDefault();search();}
});
$('quality-weight').addEventListener('input',()=>{
 data.weight=Number($('quality-weight').value)||0;save();render();
});
$('offer-form').addEventListener('submit',e=>{
 e.preventDefault();
 const f=e.currentTarget;
 const raw={id:String(Date.now())+'-'+String(Math.random()).slice(2),shop:f.elements.shop.value,url:f.elements.url.value,price:f.elements.price.value,shipping:f.elements.shipping.value,quality:f.elements.quality.value,checkedAt:new Date().toISOString()};
 const item=C.cleanOffer(raw);
 if(!item){$('form-status').textContent='Vérifiez le nom, le lien public et les montants en euros.';return;}
 if(data.offers.some(o=>o.url===item.url)){$('form-status').textContent='Cette offre est déjà présente. Retirez-la avant de la remplacer.';return;}
 if(data.offers.length>=30){$('form-status').textContent='Limite de 30 offres par comparaison.';return;}
 const inputProduct=$('product').value.trim();
 if(!inputProduct){$('form-status').textContent='Indiquez d’abord le nom exact du produit.';return;}
 if(inputProduct!==data.product&&data.offers.length){
  $('form-status').textContent='Vous avez changé de produit. Cliquez sur « Rechercher des offres » pour confirmer le changement avant d’ajouter ce prix.';
  return;
 }
 data.product=inputProduct;
 data.offers.push(item);save();render();
 $('form-status').textContent='Offre ajoutée et comparée.';
 f.reset();f.elements.shipping.value='0';
});
$('clear-offers').addEventListener('click',()=>{
 if(!data.offers.length)return;
 if(window.confirm('Effacer toutes les offres enregistrées sur cet appareil ?')){
  data.offers=[];save();render();$('form-status').textContent='Offres effacées.';
 }
});
render();
if(data.product){
 const q=$('search-links');
 C.searchLinks(data.product).forEach(link=>{
  const a=el('a','',link.name+' ↗');a.href=link.url;a.target='_blank';a.rel='noopener noreferrer';q.append(a);
 });
}
})();