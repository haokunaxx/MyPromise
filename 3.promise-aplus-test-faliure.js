/**
 * 当前代码直接拿去a+测试，会发现很多报错
 * 1. Both `onFulfilled` and `onRejected` are optional arguments. 2.2.1.1: If `onFulfilled` is not a function, it must be ignored. applied to a promise rejected and then chained off of `onFulfilled` is `undefined`
 * 没有对参数进行容错处理，参数为空的情况下没有进行处理
 * 2. `then` must return a promise: `promise2 = promise1.then(onFulfilled, onRejected)` 2.2.7.2: If either `onFulfilled` or `onRejected` throws an exception `e`, `promise2` must be rejected with `e` as the reason. The reason is an error already-rejected:
 * 没有then传入的回调执行作错误处理
 * 
 * 错误修改在文件 4.promise-aplus-test-success.js
 * 1 对应 =》 4.promise-aplus-test-success.js的115 - 116行
 * 2 对应 =》 4.promise-aplus-test-success.js的118 - 133行
 * 
 * 此外对于Promise的executor执行也进行了错误处理，对应 =》 4.promise-aplus-test-success.js的87 - 91行
 * */ 

const STATE = {
    'FULFILLED':'fulfilled',
    'REJECTED':'rejected',
    'PENDING':'pending'
}

function nextTick(callback){
    if(typeof process !== 'undefined' && typeof process.nextTick === 'function'){
        process.nextTick(callback)
    }else if(MutationObserver){
        let observer = new MutationObserver(callback),
            textNode = document.createTextNode('1')
        observer.observe(textNode,{
            characterData:true
        })
        textNode.data = '2'
    }
}

function resolvePromiseWithResult(resolvePromise,x,resolve,reject){
    if(x === resolvePromise){
        return reject(new TypeError('Chaining cycle detected for promise #<Promise>'))
    }
    if(typeof x === 'object' || typeof x === 'function'){
        if(x === null){
            return resolve(x)
        }
        let called = false,then
        try{
            then = x.then
        }catch(err){
            return reject(err)
        }
        if(typeof then === 'function'){
            try{
                then.call(x,_res => {
                    if(called){return}
                    called = true
                    resolvePromiseWithResult(resolvePromise,_res,resolve,reject)
                },_err=>{
                    if(called){return }
                    called = true
                    reject(_err)
                })
            }catch(err){
                if(called)return
                return reject(err)
            }
        }else{
            resolve(x)
        }
    }else{
        resolve(x)
    }
}
class MyPromise{
    constructor(executor){
        this.state = STATE.PENDING
        this.value = undefined
        this.resolveCallbacks = []
        this.rejectedCallbacks = []
        executor(this.resolve,this.reject)
    }
    resolve = (value) => {
        if(this.state !== STATE.PENDING){
            return
        }
        this.state = STATE.FULFILLED
        this.value = value
        while(this.resolveCallbacks.length > 0){
            this.resolveCallbacks.shift()(value)
        }
    }
    reject = (reason) => {
        if(this.state !== STATE.PENDING){
            return
        }
        this.state = STATE.REJECTED
        this.value = reason

        while(this.rejectedCallbacks.length > 0){
            this.rejectedCallbacks.shift()(reason)
        }
    }
    then(onfulfilled,onrejected){
        let returnPromise = new MyPromise((resolve,reject)=>{
            const microtask_onfulfilled = () => nextTick(() => {
                let res = onfulfilled(this.value)
                resolvePromiseWithResult(returnPromise,res,resolve,reject)
            })
            const microtask_onrejected = () => nextTick(() => {
                let res = onrejected(this.value)
                resolvePromiseWithResult(returnPromise,res,resolve,reject)
            })
            if(this.state === STATE.FULFILLED){
                microtask_onfulfilled()
            }else if(this.state === STATE.REJECTED){
                microtask_onrejected()
            }else{
                this.resolveCallbacks.push(microtask_onfulfilled)
                this.rejectedCallbacks.push(microtask_onrejected)
            }
        })
        return returnPromise
    }
}

MyPromise.deferred = function () {
    var result = {};
    result.promise = new MyPromise(function (resolve, reject) {
        result.resolve = resolve;
        result.reject = reject;
    });
  
    return result;
}
module.exports = MyPromise;
