const root=require('node:path').resolve(__dirname, '../..');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const mongoose=require(root+'/backend/node_modules/mongoose');
const express=require(root+'/backend/node_modules/express');
const bcrypt=require(root+'/backend/node_modules/bcrypt');
const model=n=>require(root+'/backend/dist/models/'+n).default;
const User=model('user'),Product=model('product'),Order=model('order'),Cart=model('cart'),Proc=model('procurement');
const output=require('node:fs').mkdtempSync(require('node:path').join(require('node:os').tmpdir(),'printing-house-regression-'));
console.log('Test output: '+output);
const invoice=require(root+'/backend/dist/utils/invoice');const originalInvoice=invoice.generateInvoicePdf;
let emailCalls=0, failEmail=false;
require(root+'/backend/dist/utils/brevo-mail').sendBrevoEmail=async()=>{emailCalls++;if(failEmail)throw Error('simulated delivery failure')};
invoice.generateInvoicePdf=(o,c,p,dir,prices)=>originalInvoice(o,c,p,output+'/invoices',prices);
const results=[];let base,server;const db='printing_house_audit_'+Date.now();
async function request(method,url,body){const r=await fetch(base+url,{method,headers:body===undefined?{}:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const text=await r.text();let data;try{data=JSON.parse(text)}catch{data=text}return {status:r.status,data,type:r.headers.get('content-type')}}
async function test(name,fn){try{await fn();results.push({name,pass:true});console.log('PASS '+name)}catch(e){results.push({name,pass:false,error:e.message});console.log('FAIL '+name+' '+e.message)}}
async function status(method,url,body,expected){
if (method === 'POST' && url === '/orders/confirm' && body?.clientUsername === 'client' && Array.isArray(body.items)) {
  await Cart.findOneAndUpdate({clientUsername:body.clientUsername},{$set:{items:body.items,checkingOut:false}},{upsert:true});
}
const r=await request(method,url,body);assert.equal(r.status,expected,JSON.stringify({status:r.status,body:r.data}).slice(0,220));return r.data}
const item=(extra={})=>({productCode:'SHARED',printingHouseUsername:'printerA',productName:'Forged name',quantity:2,selectedColor:'White',selectedPrintService:{serviceId:'S1'},unitPrice:0,totalPrice:0,printText:'Test',...extra});
const registration=(extra={})=>({username:'registered',password:'Valid12!',email:'registered@example.test',firstName:'Test',lastName:'User',phone:'123',role:'client',clientType:'individual',...extra});
let productA,productB,invoiceId,procId;
(async()=>{
await mongoose.connect('mongodb://127.0.0.1:27017/'+db);console.log('ISOLATED DATABASE '+db);
for(const name of ['user','product','order','cart','procurement','comment','reaction','category']) await model(name).init();
const hash=await bcrypt.hash('Valid12!',4);
for(const [username,role,clientType,approved,active] of [['client','client','individual',true,true],['legal','client','legal',true,true],['pending','client','individual',false,true],['inactive','client','individual',true,false],['printerA','printer',null,true,true],['printerB','printer',null,true,true],['printerEmpty','printer',null,true,true],['admin','admin',null,true,true]]) await User.create({username,role,clientType,approved,active,passwordHash:hash,firstName:'Test',lastName:'User',phone:'123',email:username+'@example.test',profileImage:'default.jpg'});
productA=await Product.create({code:'SHARED',name:'Shirt',printingHouseUsername:'printerA',category:'Clothes',subcategory:'Shirts',stock:50,unitPrice:100,active:true,likes:0,dislikes:0,colors:['White'],printServices:[{serviceId:'S1',printType:'Screen',additionalPricePerItem:20,maxWidthMm:100,maxHeightMm:200}]});
productB=await Product.create({code:'SHARED',name:'Shirt',printingHouseUsername:'printerB',category:'Clothes',subcategory:'Shirts',stock:50,unitPrice:200,active:true,likes:0,dislikes:0,colors:['Black'],printServices:[]});
await Product.create([{code:'ZERO',name:'Zero',printingHouseUsername:'printerA',active:true,stock:0,unitPrice:1},{code:'INACTIVE',name:'Hidden',printingHouseUsername:'printerA',active:false,stock:9,unitPrice:1}]);
fs.mkdirSync(output+'/uploads',{recursive:true});
const multer=require(root+'/backend/node_modules/multer');const originalStorage=multer.diskStorage;multer.diskStorage=options=>originalStorage({...options,destination:(_req,_file,cb)=>cb(null,output+'/uploads')});
const app=express();app.use(express.json());for(const name of ['user','product','order','cart','procurement','comment','category']){const plural={category:'categories',procurement:'procurements'}[name]||name+'s';app.use('/'+plural,require(root+'/backend/dist/routes/'+name+'.routes').default)}
await new Promise(resolve=>server=app.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;
await test('Registration valid and password hashed',async()=>{await status('POST','/users/register',registration(),201);const u=await User.findOne({username:'registered'});assert.notEqual(u.passwordHash,'Valid12!');assert.equal(await bcrypt.compare('Valid12!',u.passwordHash),true);assert.equal(u.approved,false);assert.equal(u.active,true)});
await test('Registration duplicate username rejected',()=>status('POST','/users/register',registration({email:'other@example.test'}),400));
await test('Registration duplicate email rejected',()=>status('POST','/users/register',registration({username:'different'}),400));
await test('Registration admin role rejected',()=>status('POST','/users/register',registration({role:'admin'}),400));
await test('Registration missing body rejected',()=>status('POST','/users/register',{},400));
await test('Registration weak password rejected',()=>status('POST','/users/register',registration({username:'weak',email:'weak@example.test',password:'x'}),400));
await test('Registration malformed email rejected',()=>status('POST','/users/register',registration({username:'bademail',email:'not-an-email'}),400));
await test('Registration missing required name returns validation error',()=>status('POST','/users/register',registration({username:'noname',email:'noname@example.test',firstName:''}),400));
await test('Registration invalid institution number rejected',()=>status('POST','/users/register',registration({role:'printer',registrationNumber:'123',pib:'123456789'}),400));
await test('Registration PIB leading zero rejected',()=>status('POST','/users/register',registration({role:'printer',registrationNumber:'12345678',pib:'023456789'}),400));
await test('Login success without password hash',async()=>{const u=await status('POST','/users/login',{username:'client',password:'Valid12!'},200);assert.equal(u.username,'client');assert.equal('passwordHash' in u,false)});
for(const [name,body,expected] of [['wrong password',{username:'client',password:'wrong'},401],['missing user',{username:'missing',password:'x'},401],['malformed username',{username:{$ne:null},password:'x'},401],['empty',{},401],['pending',{username:'pending',password:'Valid12!'},403],['inactive',{username:'inactive',password:'Valid12!'},403]])await test('Login '+name,()=>status('POST','/users/login',body,expected));
await test('Admin login success',()=>status('POST','/users/admin-login',{username:'admin',password:'Valid12!'},200));
await test('Admin login rejects client',async()=>assert.ok([401,403].includes((await request('POST','/users/admin-login',{username:'client',password:'Valid12!'})).status)));
await test('Public user response excludes passwordHash',async()=>assert.equal('passwordHash' in await status('GET','/users/client',undefined,200),false));
await test('All-users response excludes passwordHash',async()=>assert.equal((await status('GET','/users/getAll',undefined,200)).some(u=>'passwordHash' in u),false));
// Session authorization is covered only when enabled; prior project scope deferred it.
await test('Profile username/password/role cannot be changed',async()=>{const old=await User.findOne({username:'client'});await status('PUT','/users/client',{username:'renamed',role:'admin',passwordHash:'x'},200);const u=await User.findOne({username:'client'});assert.equal(u.role,'client');assert.equal(u.passwordHash,old.passwordHash)});
await test('Profile empty fields do not overwrite values',async()=>{await status('PUT','/users/client',{firstName:'',pib:''},200);assert.equal((await User.findOne({username:'client'})).firstName,'Test')});
await test('Profile duplicate email rejected',()=>status('PUT','/users/client',{email:'legal@example.test'},400));
await test('Profile invalid email rejected',()=>status('PUT','/users/client',{email:'bad'},400));
await test('Profile malformed field returns 400',()=>status('PUT','/users/client',{firstName:123},400));
await test('Printer invalid PIB returns 400',()=>status('PUT','/users/printerA',{pib:'012345678'},400));
await test('Missing user returns 404',()=>status('GET','/users/missing',undefined,404));
await test('Printer endpoint excludes clients',()=>status('GET','/users/printer/client',undefined,404));
await test('Printer count reflects active approved printers',async()=>assert.equal((await status('GET','/users/printing-houses/count',undefined,200)).count,3));
await test('Search excludes inactive and zero stock',async()=>{const p=await status('GET','/products/search',undefined,200);assert.equal(p.length,2);assert.ok(p.every(p=>p.active&&p.stock>0))});
await test('Search case insensitive',async()=>assert.equal((await status('GET','/products/search?name=sHiRt',undefined,200)).length,2));
await test('Search category filter',async()=>assert.equal((await status('GET','/products/search?category=none',undefined,200)).length,0));
await test('Search special character does not cause 500',async()=>assert.notEqual((await request('GET','/products/search?name=%5B')).status,500));
await test('Top products maximum five',async()=>assert.ok((await status('GET','/products/getTop',undefined,200)).length<=5));
await test('Inactive product details rejected',()=>status('GET','/products/INACTIVE',undefined,404));
await test('Missing product details rejected',()=>status('GET','/products/missing',undefined,404));
await test('Product detail preserves selected printer for duplicate code',async()=>{const p=await status('GET','/products/SHARED?printingHouseUsername=printerB',undefined,200);assert.equal(p.printingHouseUsername,'printerB')});
const printerProduct={code:'NEW',name:'New',description:'',category:'Clothes',subcategory:'Shirts',stock:5,unitPrice:10,colors:[],mainImage:'',active:true,printingHouseUsername:'printerA'};
await test('Printer creates product',()=>status('POST','/products/printer/create',printerProduct,201));
await test('Duplicate code same printer rejected',()=>status('POST','/products/printer/create',printerProduct,400));
await test('Same code other printer permitted',()=>status('POST','/products/printer/create',{...printerProduct,printingHouseUsername:'printerB'},201));
await test('Negative stock rejected',()=>status('POST','/products/printer/create',{...printerProduct,code:'NEG',stock:-1},400));
await test('Stock update selects correct printer',async()=>{await status('PUT','/products/printer/SHARED/stock',{printingHouseUsername:'printerB',stock:40},200);assert.equal((await Product.findById(productA._id)).stock,50);assert.equal((await Product.findById(productB._id)).stock,40)});
const service={printingHouseUsername:'printerB',serviceId:'S2',name:'Digital',maxHeightMm:200,maxWidthMm:100,additionalPricePerItem:30};
await test('Print service dimensions saved to correct printer',async()=>{await status('POST','/products/printer/SHARED/print-services',service,200);const p=await Product.findById(productB._id);assert.equal(p.printServices[0].maxWidthMm,100);assert.equal(p.printServices[0].maxHeightMm,200)});
await test('Duplicate print service rejected',()=>status('POST','/products/printer/SHARED/print-services',service,400));
await test('Zero print width rejected',()=>status('POST','/products/printer/SHARED/print-services',{...service,serviceId:'S3',maxWidthMm:0},400));
await test('Remove service from correct printer',()=>status('DELETE','/products/printer/SHARED/print-services/S2',{printingHouseUsername:'printerB'},200));
await test('Empty cart',async()=>assert.equal((await status('GET','/carts/client',undefined,200)).items.length,0));
await test('Add valid cart item',async()=>assert.equal((await status('POST','/carts/client/items',item(),200)).items.length,1));
for(const q of [0,-1,1.5])await test('Cart invalid quantity '+q,()=>status('POST','/carts/client/items',item({quantity:q}),400));
await test('Cart out of range removal rejected',()=>status('DELETE','/carts/client/items/99',undefined,400));
await test('Cart remove valid item',async()=>assert.equal((await status('DELETE','/carts/client/items/0',undefined,200)).items.length,0));
await test('Cart rejects nonexistent product',()=>status('POST','/carts/client/items',item({productCode:'missing'}),400));
await test('Clear cart',async()=>assert.equal((await status('DELETE','/carts/client',undefined,200)).items.length,0));
for(const [name,items] of [['empty',[]],['quantity zero',[item({quantity:0})]],['quantity fractional',[item({quantity:1.1})]],['wrong color',[item({selectedColor:'Black'})]],['wrong service',[item({selectedPrintService:{serviceId:'missing'}})]],['wrong printer',[item({printingHouseUsername:'missing'})]],['combined excess stock',[item({quantity:30}),item({quantity:30})]]])await test('Confirm rejects '+name,async()=>{const count=await Order.countDocuments();await status('POST','/orders/confirm',{clientUsername:'client',items},name === 'empty' ? 409 : 400);assert.equal(await Order.countDocuments(),count)});
await test('Legal client cannot use individual checkout',()=>status('POST','/orders/confirm',{clientUsername:'legal',items:[item()]},400));
await test('Confirm uses real price/service/name and correct stock',async()=>{const r=await status('POST','/orders/confirm',{clientUsername:'client',items:[item()]},201);invoiceId=r.orders[0].invoiceId;assert.equal(r.orders[0].totalPrice,240);assert.equal(r.orders[0].items[0].productName,'Shirt');assert.equal((await Product.findById(productA._id)).stock,48);assert.equal((await Product.findById(productB._id)).stock,40);assert.equal('emailSent'in r,false);assert.equal(fs.readFileSync(output+'/invoices/'+invoiceId+'.pdf').subarray(0,5).toString(),'%PDF-')});
await test('Repeated identical confirmation does not duplicate order',async()=>{const before=await Order.countDocuments();await request('POST','/orders/confirm',{clientUsername:'client',items:[item()]});assert.equal(await Order.countDocuments(),before)});
await test('Same code different printers creates separate orders',async()=>{const r=await status('POST','/orders/confirm',{clientUsername:'client',items:[item({quantity:1}),item({quantity:1,printingHouseUsername:'printerB',selectedColor:'Black',selectedPrintService:null})]},201);assert.equal(r.orders.length,2);assert.deepEqual(r.orders.map(o=>o.totalPrice).sort((a,b)=>a-b),[120,200])});
await test('Cancel restores stock',async()=>{const before=(await Product.findById(productA._id)).stock;await status('PUT','/orders/'+invoiceId+'/cancel',{},200);assert.equal((await Product.findById(productA._id)).stock,before+2)});
await test('Cannot cancel twice',()=>status('PUT','/orders/'+invoiceId+'/cancel',{},400));
let receivedOrder=await Order.create({clientUsername:'client',printingHouseUsername:'printerB',items:[{productCode:'SHARED',productName:'Shirt',quantity:5}],totalPrice:200,status:'naručeno'});const receivedId=receivedOrder.invoiceId;
await test('Status cannot skip printing',()=>status('PUT','/orders/'+receivedId+'/status',{status:'isporučeno'},400));
await test('Mark received too early rejected',()=>status('PUT','/orders/'+receivedId+'/received',{},400));
await test('Status order -> printing',()=>status('PUT','/orders/'+receivedId+'/status',{status:'u štampi'},200));
await test('Status printing -> delivered',()=>status('PUT','/orders/'+receivedId+'/status',{status:'isporučeno'},200));
await test('Status delivered -> received',()=>status('PUT','/orders/'+receivedId+'/received',{},200));
await test('Cannot receive twice',()=>status('PUT','/orders/'+receivedId+'/received',{},400));
const reaction={username:'client',invoiceId:receivedId,reaction:'like'};
await test('Reaction increments invoice printer product',async()=>{await status('POST','/products/SHARED/reaction',reaction,200);assert.equal((await Product.findById(productB._id)).likes,1);assert.equal((await Product.findById(productA._id)).likes,0)});
await test('Second reaction same invoice rejected',()=>status('POST','/products/SHARED/reaction',{...reaction,reaction:'dislike'},400));
await test('Wrong invoice owner reaction rejected',()=>status('POST','/products/SHARED/reaction',{...reaction,username:'legal'},400));
await test('Comment received product succeeds',()=>status('POST','/comments',{username:'client',productCode:'SHARED',invoiceId:receivedId,text:'Good'},201));
await test('Duplicate comment same invoice rejected',()=>status('POST','/comments',{username:'client',productCode:'SHARED',invoiceId:receivedId,text:'Again'},400));
await test('Blank comment rejected',()=>status('POST','/comments',{username:'client',productCode:'SHARED',invoiceId:receivedId,text:'  '},400));
await test('Public comments hide invoiceId',async()=>assert.ok((await status('GET','/comments/product/SHARED?printingHouseUsername=printerB',undefined,200)).every(c=>!('invoiceId'in c))));
await test('Different received invoice permits new comment and reaction',async()=>{const o=await Order.create({clientUsername:'client',printingHouseUsername:'printerA',items:[{productCode:'SHARED',quantity:1}],status:'primljeno'});await status('POST','/comments',{username:'client',productCode:'SHARED',invoiceId:o.invoiceId,text:'Another'},201);await status('POST','/products/SHARED/reaction',{...reaction,invoiceId:o.invoiceId},200)});
await test('Archive per-invoice flags',async()=>{const a=await status('GET','/orders/client/client/archive',undefined,200);const e=a.find(i=>i.invoiceId===receivedId);assert.equal(e.hasReacted,true);assert.equal(e.hasCommented,true)});
await test('Individual client cannot create procurement',()=>status('POST','/procurements/confirm',{clientUsername:'client'},403));
await test('Procurement empty cart rejected',()=>status('POST','/procurements/confirm',{clientUsername:'legal'},400));
await test('Procurement create real name, ten minute deadline, clear cart, mock emails',async()=>{await Cart.create({clientUsername:'legal',items:[item()]});const r=await status('POST','/procurements/confirm',{clientUsername:'legal'},201);procId=r.procurement.procurementId;assert.equal(r.procurement.items[0].productName,'Shirt');assert.equal(new Date(r.procurement.expiresAt)-new Date(r.procurement.createdAt),600000);assert.equal((await Cart.findOne({clientUsername:'legal'})).items.length,0);assert.equal(emailCalls,3)});
await test('Printer missing requested product cannot see procurement',async()=>assert.equal((await status('GET','/procurements/active/printer/printerEmpty',undefined,200)).length,0));
await test('Eligible printer sees procurement with competitor offers hidden',async()=>{const a=await status('GET','/procurements/active/printer/printerA',undefined,200);assert.equal(a.length,1);assert.equal(a[0].offers.length,0)});
await test('Partial/unfulfillable offer rejected',()=>status('POST','/procurements/'+procId+'/offers',{printingHouseUsername:'printerEmpty',totalPrice:1},400));
await test('Zero price offer rejected',()=>status('POST','/procurements/'+procId+'/offers',{printingHouseUsername:'printerA',totalPrice:0},400));
await test('Valid offer saved',()=>status('POST','/procurements/'+procId+'/offers',{printingHouseUsername:'printerA',totalPrice:120},201));
await test('Duplicate offer rejected',()=>status('POST','/procurements/'+procId+'/offers',{printingHouseUsername:'printerA',totalPrice:100},400));
await test('Second printer valid offer',()=>status('POST','/procurements/'+procId+'/offers',{printingHouseUsername:'printerB',totalPrice:200},201));
await test('Active procurement report rejected',()=>status('GET','/procurements/'+procId+'/report?clientUsername=legal',undefined,400));
await test('Expired procurement rejects new offer',async()=>{await Proc.updateOne({procurementId:procId},{$set:{expiresAt:new Date(Date.now()-1000)}});await status('POST','/procurements/'+procId+'/offers',{printingHouseUsername:'printerEmpty',totalPrice:50},409)});
await test('Winner rechecks stock and skips cheaper insufficient printer',async()=>{await Product.updateOne({_id:productA._id},{$set:{stock:0}});const before=(await Product.findById(productB._id)).stock;await require(root+'/backend/dist/controllers/procurement.controller').finalizeProcurement(procId);const p=await Proc.findOne({procurementId:procId});assert.equal(p.status,'finished');assert.equal(p.winningPrintingHouseUsername,'printerB');assert.equal((await Product.findById(productB._id)).stock,before-2);const o=await Order.findOne({invoiceId:p.invoiceId});assert.equal(o.status,'u štampi');assert.equal(o.totalPrice,200)});
await test('Finalization repeat does not create another order',async()=>{const count=await Order.countDocuments();await require(root+'/backend/dist/controllers/procurement.controller').finalizeProcurement(procId);assert.equal(await Order.countDocuments(),count)});
await test('Procurement report generates PDF',async()=>{const r=await request('GET','/procurements/'+procId+'/report?clientUsername=legal');assert.equal(r.status,200);assert.equal(r.type,'application/pdf');assert.ok(r.data.startsWith('%PDF-'))});
await test('Report rejects another client',()=>status('GET','/procurements/'+procId+'/report?clientUsername=client',undefined,403));
await test('Email failure preserves procurement and returns warning',async()=>{await Product.updateOne({_id:productA._id},{$set:{stock:10}});await Cart.updateOne({clientUsername:'legal'},{$set:{items:[item()]}});failEmail=true;const r=await status('POST','/procurements/confirm',{clientUsername:'legal'},201);assert.equal(r.emailSent,false);assert.ok(r.warning);failEmail=false});
await test('Expired procurement no offers finishes without order',async()=>{const p=await Proc.findOne({status:'active'});p.expiresAt=new Date(Date.now()-1000);await p.save();const count=await Order.countDocuments();await require(root+'/backend/dist/controllers/procurement.controller').finalizeProcurement(p.procurementId);assert.equal((await Proc.findById(p._id)).status,'finished');assert.equal(await Order.countDocuments(),count)});
await test('Create category',()=>status('POST','/categories/create',{name:'Test category'},201));
await test('Duplicate category rejected',()=>status('POST','/categories/create',{name:'Test category'},400));
await test('Create subcategory',()=>status('POST','/categories/Test%20category/subcategories',{name:'Sub'},200));
await test('Duplicate subcategory rejected',()=>status('POST','/categories/Test%20category/subcategories',{name:'Sub'},400));
await test('Missing category rejected',()=>status('POST','/categories/missing/subcategories',{name:'Sub'},404));
await test('Profile valid printer identifiers update and remain unique',async()=>{await status('PUT','/users/printerA',{registrationNumber:'12345678',pib:'123456789'},200);await status('PUT','/users/printerA',{registrationNumber:'12345678',pib:'123456789'},200);await status('PUT','/users/printerB',{registrationNumber:'12345678'},400);await status('PUT','/users/printerB',{pib:'123456789'},400)});
await test('Concurrent registration same username creates at most one user',async()=>{const data=registration({username:'raceuser',email:'raceuser@example.test'});await Promise.all([request('POST','/users/register',data),request('POST','/users/register',data)]);assert.equal(await User.countDocuments({username:'raceuser'}),1)});
await test('Import allows same code owned by another printer',async()=>{await Product.create({...printerProduct,code:'IMPORT-SHARED',printingHouseUsername:'printerA'});await status('POST','/products/printer/import',{printingHouseUsername:'printerB',products:[{...printerProduct,code:'IMPORT-SHARED'}]},201)});
await test('Legacy create-order cannot bypass saved cart',()=>status('POST','/orders/create',{clientUsername:'client',printingHouseUsername:'printerA',items:[{productCode:'missing',quantity:-2}],totalPrice:-100},409));
await test('Concurrent stock confirmation does not oversell',async()=>{const p=await Product.create({code:'RACE',name:'Race',printingHouseUsername:'printerA',unitPrice:10,stock:1,active:true,colors:[],printServices:[]});const count=await Order.countDocuments();const body={clientUsername:'client',items:[item({productCode:'RACE',quantity:1,selectedColor:'',selectedPrintService:null})]};await Cart.findOneAndUpdate({clientUsername:'client'},{$set:{items:body.items,checkingOut:false}},{upsert:true});const r=await Promise.all([request('POST','/orders/confirm',body),request('POST','/orders/confirm',body)]);assert.equal(r.filter(x=>x.status===201).length,1);assert.equal((await Product.findById(p._id)).stock,0);assert.equal(await Order.countDocuments(),count+1)});
await test('PDF failure keeps confirmed order and gives warning',async()=>{const original=invoice.generateInvoicePdf;invoice.generateInvoicePdf=async()=>{throw Error('Simulated PDF failure')};try{const r=await status('POST','/orders/confirm',{clientUsername:'client',items:[item({quantity:1})]},201);assert.ok(r.warning);assert.equal(await Order.countDocuments({invoiceId:r.orders[0].invoiceId}),1)}finally{invoice.generateInvoicePdf=original}});
await test('Simultaneous duplicate offers save at most one',async()=>{const p=await Proc.create({clientUsername:'legal',items:[{productCode:'SHARED',productName:'Shirt',quantity:1}],expiresAt:new Date(Date.now()+600000)});const r=await Promise.all([request('POST','/procurements/'+p.procurementId+'/offers',{printingHouseUsername:'printerA',totalPrice:12}),request('POST','/procurements/'+p.procurementId+'/offers',{printingHouseUsername:'printerA',totalPrice:13})]);assert.equal(r.filter(x=>x.status===201).length,1);assert.equal((await Proc.findById(p._id)).offers.length,1)});
await test('Procurement normalizes product names and combines quantities',async()=>{const f=require(root+'/backend/dist/controllers/procurement.controller').requiredQuantities;assert.equal(f([{productName:' Shirt ',quantity:2},{productName:'SHIRT',quantity:3}]).get('shirt'),5);assert.throws(()=>f([{productName:'Shirt',quantity:0}]))});
await test('Procurement lowest valid offer wins once under concurrent finalization',async()=>{const p=await Proc.create({clientUsername:'legal',items:[{productCode:'SHARED',productName:' SHIRT ',quantity:1}],expiresAt:new Date(Date.now()-1000),offers:[{printingHouseUsername:'printerA',totalPrice:30},{printingHouseUsername:'printerB',totalPrice:20}]});const before=await Order.countDocuments();const f=require(root+'/backend/dist/controllers/procurement.controller').finalizeProcurement;await Promise.all([f(p.procurementId),f(p.procurementId)]);assert.equal((await Proc.findById(p._id)).winningPrintingHouseUsername,'printerB');assert.equal(await Order.countDocuments(),before+1)});
await test('Inactive legal client cannot create procurement',async()=>{await User.updateOne({username:'legal'},{$set:{active:false}});await Cart.updateOne({clientUsername:'legal'},{$set:{items:[item({quantity:1})]}});try{await status('POST','/procurements/confirm',{clientUsername:'legal'},403)}finally{await User.updateOne({username:'legal'},{$set:{active:true}})}});

const zlib=require('node:zlib');
function png(width,height){function crc(b){let c=0xffffffff;for(const byte of b){c^=byte;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0)}return (c^0xffffffff)>>>0}function chunk(type,data){const name=Buffer.from(type),len=Buffer.alloc(4),sum=Buffer.alloc(4);len.writeUInt32BE(data.length);sum.writeUInt32BE(crc(Buffer.concat([name,data])));return Buffer.concat([len,name,data,sum])}const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(width);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=2;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(Buffer.alloc(height*(width*3+1)))),chunk('IEND',Buffer.alloc(0))])}
async function upload(url,method,field,bytes,mime,fields={}){const form=new FormData();for(const[k,v]of Object.entries(fields))form.append(k,v);form.append(field,new Blob([bytes],{type:mime}),'test.png');const r=await fetch(base+url,{method,body:form});const body=await r.json();return {status:r.status,data:body}}
for(const [width,height,expected]of [[100,100,200],[250,250,200],[99,100,400],[100,251,400]])await test('Profile image dimensions '+width+'x'+height,async()=>assert.equal((await upload('/users/client/profile-image','PUT','profileImage',png(width,height),'image/png')).status,expected));
await test('Profile image rejects non-image MIME',async()=>assert.equal((await upload('/users/client/profile-image','PUT','profileImage',Buffer.from('not image'),'text/plain')).status,400));
await test('Profile image rejects spoofed PNG bytes',async()=>assert.equal((await upload('/users/client/profile-image','PUT','profileImage',Buffer.from('not image'),'image/png')).status,400));
await test('Profile image over 5MB rejected',async()=>assert.equal((await upload('/users/client/profile-image','PUT','profileImage',Buffer.alloc(5*1024*1024+1),'image/png')).status,400));
await test('Registration multipart with image succeeds',async()=>{const r=await upload('/users/register','POST','profileImage',png(150,150),'image/png',registration({username:'withimage',email:'withimage@example.test'}));assert.equal(r.status,201);assert.match((await User.findOne({username:'withimage'})).profileImage,/^\/uploads\/profiles\//)});
await test('Failed registration removes uploaded file',async()=>{const before=fs.readdirSync(output+'/uploads').length;const r=await upload('/users/register','POST','profileImage',png(150,150),'image/png',registration());assert.equal(r.status,400);assert.equal(fs.readdirSync(output+'/uploads').length,before)});
await test('Product image upload updates correct printer',async()=>{const r=await upload('/products/printer/SHARED/image','PUT','productImage',png(300,300),'image/png',{printingHouseUsername:'printerB'});assert.equal(r.status,200);assert.match((await Product.findById(productB._id)).mainImage,/^\/images\/products\//);assert.equal((await Product.findById(productA._id)).mainImage,undefined)});
await test('Product image rejects fake image data',async()=>assert.equal((await upload('/products/printer/SHARED/image','PUT','productImage',Buffer.from('not image'),'image/png',{printingHouseUsername:'printerB'})).status,400));
await test('Product image unknown owner rejected and file removed',async()=>{const before=fs.readdirSync(output+'/uploads').length;const r=await upload('/products/printer/SHARED/image','PUT','productImage',png(100,100),'image/png',{printingHouseUsername:'missing'});assert.equal(r.status,404);assert.equal(fs.readdirSync(output+'/uploads').length,before)});


await test('Comments from another printer are not displayed', async () => {
  const commentsA = await status('GET', '/comments/product/SHARED?printingHouseUsername=printerA', undefined, 200);
  const commentsB = await status('GET', '/comments/product/SHARED?printingHouseUsername=printerB', undefined, 200);
  assert.equal(commentsA.length, 1);
  assert.equal(commentsB.length, 1);
  assert.equal(commentsA[0].text, 'Another');
  assert.equal(commentsB[0].text, 'Good');
});
await test('Double cancellation restores stock only once', async () => {
  const product = await Product.findById(productA._id);
  const order = await Order.create({clientUsername:'client',printingHouseUsername:'printerA',items:[{productCode:'SHARED',quantity:2}],status:'naručeno'});
  const responses = await Promise.all([request('PUT','/orders/'+order.invoiceId+'/cancel',{}), request('PUT','/orders/'+order.invoiceId+'/cancel',{})]);
  assert.equal(responses.filter(response => response.status === 200).length, 1);
  assert.equal((await Product.findById(productA._id)).stock, product.stock + 2);
});
await test('Cart changes cannot race a confirmation claim', async () => {
  await Cart.findOneAndUpdate({clientUsername:'client'},{$set:{items:[item()],checkingOut:true}},{upsert:true});
  for (const [method,url,body] of [['POST','/carts/client/items',item()],['DELETE','/carts/client/items/0',undefined],['DELETE','/carts/client',undefined]]) {
    await status(method,url,body,409);
  }
  await Cart.updateOne({clientUsername:'client'},{$set:{checkingOut:false}});
});

if (results.some(result => !result.pass)) process.exitCode = 1;
console.log('SUMMARY '+JSON.stringify({total:results.length,passed:results.filter(r=>r.pass).length,failed:results.filter(r=>!r.pass).length}));
})().catch(e=>{console.error('HARNESS ERROR',e);process.exitCode=1}).finally(async()=>{fs.writeFileSync(output+'/backend-results.json',JSON.stringify(results,null,2));if(mongoose.connection.name===db&&db.startsWith('printing_house_audit_')){await mongoose.connection.dropDatabase();console.log('Removed isolated test database '+db)}await mongoose.disconnect();if(server)await new Promise(r=>server.close(r));});
