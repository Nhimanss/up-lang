const util = require('util');


let nop = function () {}

class Expo{ //basic expression object
  [util.inspect.custom](depth, options) { //
    return this.toString();
  }
  constructor(){
    this.wipe()
  }
  wipe(){ //removes values from object
    this._value = null //literal value
    this.children = [] //value defining children values to querry
    this.data = {} //data storage
    this.listens = false //listener type
  }
  get value(){ //chain get value
    if(this.env.alive === false)return this.errorCatch(CodeError("script has stopped"));
    let src = this; //souce value

    while(src.upValue !== undefined){
      src = src.env.stackTop[src.upValue]; //point to correct object
      if(!src)return null; //empty upvalues are null and not error, in js (a => a === undefined )() -> true, //this.errorCatch(new CodeError(`upvalue contains no object`));
    }

    //src is now at correct object

    if(src.target){//is a setter therefore has a target
      let target = src.target //efficency copy


      target.data = Object.assign({},src.data) //shallow copy data object
      if(src.call){//is a function call

        Object.assign(target,src)
        target.target = undefined
      }
      else if(src.clobber){//its a word (clobber value clobbers whatever was in target)
        Object.assign(target,src.clobber)
      }
      else{//no, its a value
        target._value = src._value
      }
    }else{
      if(src.call){//is a function call
        let fn = src.call.run
        if(fn) return this.errorCatch(fn(src,src.call,src.children,src.data)); //expo.run = function(caller,self,arguments,dataStorage){ ... }
        else {
        return this.errorCatch(new CodeError(`caller, ${src.call.toString()} has no code `))
        }
      }else{//no, its a value
        return this.errorCatch(src._value) //errorCatch here is mildly pointless
      }
    }
    return null;
  }

  get type(){ //what type is it?
    if(this.target){//is a setter therefore has a target
      if(this.call){//is a function call
        return `setTo call`
      }else if(this.clobber){//its a word
        return "setTo "+this.clobber.type
      }else{//no, its a value
        return "setTo value"
      }
    }else{
      if(this.call){//is a function call
          return "call"
      }
      if(this.upValue !== undefined){ //is an upvalue therefore has .upvalue
        return "upvalue"
      }
      else{//no, its a value
        return "value"
      }
    }

    return null; //its nothing?!
  }
  get location(){
    let n = this.context
    if(n) n = n.name;
    return `${this.name || "anonymous"}@${n || "anonymous"}`

  }
  toString(){
    //totally needs reform
    return `${this.location} = [${this.target ? "("+this.target.location+") " : ""}${this.type == "value" ? typeof this._value+" " : ""}${this.type}${this.call ? ` of ${this.call.location}` : ""}]`
  }
  errorCatch(error){
    if ( error instanceof CodeError )error.stackAdd("from: "+this.toString());
    return error
  }
  evaluate(){
    let l = this.value
    if(l instanceof CodeError){

    }
  }
}
exports.Expo = Expo

class EnvContext {
  constructor(){
    this.items = {}
  }

  item(name){ //gets an item from items
    let l = this.items[name]
    if(l)return l;
    l = new Expo()
    l.name = name
    l.context = this
    l.env = this.env
    this.items[name] = l
    return l;
  }
  itemExists(name){ //gets an item from items
    return name in this.items
  }

}
exports.EnvContext = EnvContext

class Env {
  constructor(){
    this.contexts = {}
    this.stack = []
    this.stackTop = [] //be careful not to have an unbalenced push to pop ratio and become null
  }
  stackPush(args){
    this.stack.push(this.stackTop)
    this.stackTop = args
  }
  stackPop(){
    if(this.stack.length < 1)throw new Error("cannot pop empty stack")
    this.stackTop = this.stack.pop()
  }


  context(name){ //gets an item from contexts
    let l = this.contexts[name]
    if(l)return l;
    l = new EnvContext()
    l.name = name
    l.env = this
    this.contexts[name] = l
    return l;
  }

}
exports.Env = Env

//turn on as needed
//const homedir = require('os').homedir();
//const fs = require('fs');

  let $break = Object.create(null) //token that represents the break between statements
  $break[0] = "break"
  Object.freeze($break)

class CompileError extends Error {
  constructor(message,text,position) {
    super(message+" char:"+position); // (1)
    this.name = ""; // (2)
  }
}

exports.CompileError = CompileError

class CodeError {
  [util.inspect.custom](depth, options) {
    return this.toString();
  }
  constructor(message,pos) {
    this.message     = message
    this.dispMessage = message+"\n\n"
    this.stack = []
  }
  toString(){
    return this.dispMessage
  }
  stackAdd(name,comment){
    this.stack.push(name)
    this.dispMessage += name+(comment ?  ", "+comment : "")+"\n"
  }

}
exports.CodeError = CodeError

let compilePt1 = function(data){
  let lchain = {} //unused left in for compatability (var passed to all substructures)
  let p = 0
  let bytes = (amt,noadv) => {
    let l = data.substr(p,amt)
    if(!noadv)p+=amt;
    return l
  }
  let isLetter = char => char.match(/[a-zA-Z]/)
  let isNumber = char => char.match(/[0-9]/)
  let isWord   = char => char.match(/[0-9A-Za-z\-\_]/)
  let isStillNumber = char => char.match(/[0-9\.]/)

  this.body = function (lme/*top of lchain*/,isTop,argL) {
    argL = argL || []
    let doBreak = false
    while (p <= data.length) {
      let b = bytes(1)
      switch (b) {
        case "$":
          argL.push(["dollar"])
          break;
        case "@":
          if(argL[argL.length-1][0] == "word"){
            argL[argL.length-1][0] = 'atWord'
          }else{
            //it scopes context using: @ place { ... }
            argL.push(["at"])
          }
          break;
        case "\n":
        case "," :
          {
          let n = argL[argL.length-1]
          if(n === $break || n === undefined){}else{
            argL.push($break)
          }}
          break;
        case ")":
            if(isTop)throw new CompileError("attempted to close top level statement ",data,p);
            doBreak = true
            //console.log(bytes(5,true))
            break;
        case "/":
          if(bytes(1,true) == "/"){
            //console.log("comment");
            this.comment()
          }else
          if(bytes(1,true) == "*"){
            this.longComment()
          }else
          {

          }
          break;
        case " " :
        case "\t":
          //nop
          break;
        case "=":
        {
          let n = argL[argL.length-2]
          if (n === $break || n === undefined){
            let l = argL[argL.length-1]
            //console.log(l)
            if(l[0] == "word"){
              l[0] = 'setterTarget' //changes from word to setter target
            }else{
              throw new CompileError("unsupported left hand side of (single arg) equals",data,p);
            }
          }else{
            //some other condition
            //else{
              //console.log(argL)
              throw new CompileError("unsupported left hand side of (muli arg) equals",data,p);
            //}
          }
        }
        break;
        case "(":
          let l = argL[argL.length-1]
          if(l[0] == "word"){
            l[0] = "call"
            if(l[2] == null)l[2] = "func";
            let p = 3

            l[p] = []
            this.body(lme,false,l[p])
          }else
          if(l[0] == "atPtr"){
            l[0] = "atSub"
            let p = 2
            l[p] = []
            this.body(lme,false,l[p])
          }else
          {
            argL.push([ 'call', "do", 'func' , this.body(lme,false) ])
          }

          break;
        case "\"":
          argL.push(['value',this.string(lme)])
          break;
        default:
        if (isLetter(b)) {
          p--
          let l = argL[argL.length-1] || []
          if(l[0] == "atWord"){
              l[0] = "word"
              l[2] = this.word(lme)
          }else
          if(l[0] == "at"){
              l[0] = "atPtr"
              l[1] = this.word(lme)
          }else
          if(l[0] == "dollar"){ //supported but not used, should Ibe an upvalue?
            l[0] = "word w/ dollar"
            l[1] = this.word(lme)
          }
          else
          {
              argL.push(['word',this.word(lme),null])
          }

        }else if (isNumber(b)) {
          p--
          let l = argL[argL.length-1] || []
          if(l[0] == "dollar"){ // $0
            l[0] = 'upvalue'
            l[1] =  this.number(lme)
          }
          else {
            argL.push(['value',this.number(lme)])
          }

        }else if ( false )
        {

        }

      }
      if(doBreak)break; //stop the loop
    }

    return argL;
  }

  this.word = function (lme/*top of lchain*/) {
    let word = []
    while(p <= data.length){
      let b = bytes(1)
      if(isWord(b)){
        word.push(b)
      }
      else{
        p--
        break;
      }
    }
    return word.join("")
  }

  this.number = function (lme/*top of lchain*/) {
    let word = []
    while(p <= data.length){
      let b = bytes(1)
      if(isStillNumber(b)){
        word.push(b)
      }
      else{
        p--
        break;
      }
    }
    return Number(word.join(""))
  }
  this.comment = function (lme/*top of lchain*/) {
    while(p <= data.length){
      let b = bytes(1)
      if(b != "\n"){
      }
      else{
        break;
      }
    }
    return
  }
  this.string = function (lme/*top of lchain*/) {
    let word = []
    while(p <= data.length){
      let b = bytes(1)
      if(b != "\""){
        word.push(b)
      }
      else{
        break;
      }
    }
    return word.join("")
  }

  this.longComment = function (lme/*top of lchain*/) {
    while(p <= data.length){
      let b = bytes(1)
      if(b != "*"){

      }
      else{
        if(bytes(1,true) == "/"){
            break;
        }
      }
    }
    return
  }


  return this.body(lchain,true)
}
exports.compilePt1 = compilePt1

let compilePt2 = function(data,estruct,textData){
  let cstack = ['root','sys','func','main'] //stack of what to look at when looking up
  let ctop = ()=> cstack[cstack.length-1]
  let cGet = key => {
    let l;
    for (let i = cstack.length-1; l => 0;i--){
      l = estruct.context(cstack[i])
      if(l.itemExists(key))return l.item(key);
    }
    return ctop();
  }

  this.scanArgs = (chain,est,newst) => {
    newst= newst || []
    let unow = new Expo() //object w/ number keys too
    unow.env = estruct
    let push = ()=>{ //push: push and prepare new
      newst.push(unow)
      unow = new Expo()
      unow.env = estruct
    }
    for(var i=0;i<chain.length;i++){
      let l = chain[i];

      switch(l[0]){
        case "setterTarget":
          if(unow.target){
            //target allready exists (possably many words per statement)
            throw CompileError("too many setters per statement",data,l.i)
          }else{
            //console.log(l[1])
            unow.target = ( estruct.context(l[2] || ctop()).item(l[1]) ) // .target = specific || top of stack
            //console.log(ctop())
          }
          break;
        case "break":
          //push()
          break;
        case "upvalue":
          unow.upValue = l[1] //its getting distroyed somewhere >:{
          push()
          break;
        case "value":
          unow._value = l[1]
          push()
          break;
        case "call":
          unow.call = ( estruct.context( l[2] || cGet(l[1]) ).item(l[1]) ) // .call = specific || topmost existing key
          unow.children = this.scanArgs(l[3],estruct)

          {
            let call = unow.call
            if(call.onCallExpoFab)call.onCallExpoFab(unow) //whenever a new call type Expo is fabricated
          }
          push()
          break;
        case "word":
          if(unow.target){
            unow.impaler = estruct.context(l[2] || cGet(l[1])).item(l[1]) //literal copy operation // .impailer = specific || topmost existing key
          }else{
            unow = estruct.context(l[2] || cGet(l[1])).item(l[1]) // unow = specific || topmost existing key
          }
          push()
          break;
        case "atSub":
            unow.call = estruct.context("func").item("do")
            cstack.push(l[1])
            unow.children = this.scanArgs(l[2],estruct)
            cstack.pop()
            push()
          break;
      }
    }
    //if(chain.length > 0)newst.push(unow)
    return newst
  }
  return this.scanArgs(data,estruct)
}
exports.compilePt2 = compilePt2
/*
@library{
  box = blabla()
}
bold = brash
set(l,7)
himanss@beach



*/
/*
hi(a,b,c)
bold = brash
bold@himanss = brash@himanss(7) (aaaaaaaaaa!,l)
fnepfep
//
a = 7
b = mycat
c = mycat()
on(taga,click,@title(
  pi = 3.14 2.16
))
pi
pi@sky
@sky(pi)
pi @ sky ()
mydo = (
  a = 1
  b = 2
  c = 3
  7
)

//print( lsEnv() )
//whatIs( love() )

set(l, A = B) //lol a setter function call where this is possable
get(l)
kill() //makes script "liveless" (unable to effect change)
dont(wait(5,(
  a = 7
  b = 9
)))
print(l)
*/

//set(sky,a = b) //bc there is no language way to do it, a = b = c is invalid

/*
--now invalid: whyDoesThisWOrk(args-apear-in-setter-key-2) = 7 --idk eather

--now invalid: p0 = 7()
--this is stupid long should it be invalidated()
*/

/*let test_estruct = new Env()
let b = `
      //print(if( lt(a,5), a, 5 ))
      print("a")
      text()
      `*/

//test_estruct.context('main').item('')


Env.prototype.addComonFunctions = function () {

  let func = this.context("func")
  {
    func.item("do").run = function(caller,self,args,data){
      let moob = null;
      for (const item of args) {
        moob = item.value
        if(moob instanceof CodeError)return moob;
      }
      return moob;
    }
  }
  {
    let funcCmd = func.item("func")
    funcCmd.run = function(caller,self,args,data){

    }
    funcCmd.onCallExpoFab = function(newbie) {
      newbie.run = function(caller,self,args,data){
        self.env.stackPush(args) //args are now upvalues
        let code = self.children // the function body to execute my self's arguments, (property is named children)
        //(code from do)
        {
          let moob = null;
          for (const item of code) {
            moob = item.value
            if(moob instanceof CodeError)return moob;
          }
          return moob;
        }
      }
    }
  }
  {
    //list the env vars
    func.item("lsEnv").run = function(caller,self,args,data){
      let l = ""
      for (const [key, value] of Object.entries( self.env.contexts )) {
        l += `${key}:`
        for (const [key2, value2] of Object.entries( value.items )) {
            l +=
            `\t${key2}: `+
            value2.type+
            "\n"
            //value2,"\n\n\n");
        }
      }
      return l;
    }
  }
  {
    func.item("print").run = function(caller,self,args,data){
      console.log("",...args.map(v => v.value))
    }
  }
  {
    func.item("whatIs").run = function(caller,self,args,data){
      console.log("",...args.map(v => v.toString()))
    }
  }
  {
    func.item("set").run = function(caller,self,args,data){
      let l = new Expo()
      l.env = self.env
      l.target = args[0]
      l.clobber = args[1]
      return l.value
    }
  }
  {
    func.item("get").run = function(caller,self,args,data){ //mabe add property querry: get(cake,"type")
      return args[0].value
    }
  }
  {
    func.item("dont").run = function(caller,self,args,data){
      return null;
    }
  }
  {
    func.item("if").run = function(caller,self,args,data){
      let ifTest = args[0].value
      if(ifTest instanceof CodeError){
        ifTest.stackAdd("as \'test\' of: if(test,a,b)")
        return ifTest
      }
      return args[ifTest ? 1 : 2].value
    }
  }
}

Env.prototype.compileCode = function (code) {
  return compilePt2(compilePt1(code),this,code)
};

Env.prototype.runCode = function (code) {
  let l = this.compileCode(code)
  let moob;
  for (const item of l) {
    moob = item.value
    if(moob instanceof CodeError)return moob;
  }
  return moob;
};
