'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../docs/compare-core.js');
const o=(shop,price,shipping,quality)=>({id:shop,shop,url:'https://example.com/'+shop.toLowerCase(),price,shipping,quality,checkedAt:'2026-10-13T10:00:00Z'});
test('prix en virgule et prix total livraison comprise',()=>{
 assert.equal(C.price('199,99 €'),199.99);assert.equal(C.price('0'),0);assert.equal(C.price('-1'),null);assert.equal(C.price('12,789'),null);assert.equal(C.price('NaN'),null);
 const v=C.cleanOffer(o('BoutiqueA','100,00','4,50',null));assert.equal(v.total,104.5);
});
test('le prix le plus bas prend en compte la livraison',()=>{
 const result=C.compare([o('A','90','25',null),o('B','99','0',null)],.5);
 assert.equal(result.bestPrice.shop,'B');assert.equal(result.bestPrice.total,99);
 assert.equal(result.bestOverall,null);assert.equal(result.allRated,false);
});
test('le meilleur compromis n utilise des notes que si elles sont toutes renseignees',()=>{
 const offers=[o('A','90','0',2),o('B','100','0',5)];
 const cheap=C.compare(offers,0),quality=C.compare(offers,1);
 assert.equal(cheap.bestPrice.shop,'A');assert.equal(cheap.bestOverall.offer.shop,'A');
 assert.equal(quality.bestOverall.offer.shop,'B');
 assert.equal(C.compare([...offers,o('C','110','0','')],1).bestOverall,null);
});
test('les URLs sont des liens publics mais aucune page nest crawlee par le comparateur',()=>{
 assert.equal(C.publicUrl('javascript:alert(1)'),null);
 assert.equal(C.publicUrl('https://john:pwd@example.com/'),null);
 assert.equal(C.publicUrl('http://localhost/admin'),null);
 assert.equal(C.publicUrl('https://example.com/item'),'https://example.com/item');
 assert.equal(C.cleanOffer(o('X','0','0','')),null);
});
test('les sources de recherche sont des liens ouverts explicitement et échappés',()=>{
 const links=C.searchLinks('casque & réduction');
 assert.equal(links.length,3);assert.ok(links.every(x=>x.url.startsWith('https://')));
 assert.ok(links[0].url.includes('%26'));assert.deepEqual(C.searchLinks(''),[]);
});
test('les offres invalides ne faussent pas le classement et sont limitées',()=>{
 const data=C.compare([o('A','10','0',3),o('X','not a price','0',3),o('B','12','0',5)]);
 assert.equal(data.offers.length,2);assert.equal(data.bestPrice.shop,'A');assert.ok(data.offers.every(x=>x.total>0));
});
