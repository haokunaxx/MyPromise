/**
 * 当前代码通过promise aplus测试
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
        this.fulfillCallbacks = []
        this.rejectedCallbacks = []
        try{
            executor(this.resolve,this.reject)
        }catch(err){
            this.reject(err)
        }
    }
    resolve = (value) => {
        if(this.state !== STATE.PENDING){
            return
        }
        this.state = STATE.FULFILLED
        this.value = value
        while(this.fulfillCallbacks.length > 0){
            this.fulfillCallbacks.shift()(value)
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
        onfulfilled = typeof onfulfilled === 'function' ? onfulfilled : value => value
        onrejected = typeof onrejected === 'function' ? onrejected : reason => { throw reason } //没有错误接受，则抛出异常
        let returnPromise = new MyPromise((resolve,reject)=>{
            const microtask_onfulfilled = () => nextTick(() => {
                try{
                    let res = onfulfilled(this.value)
                    resolvePromiseWithResult(returnPromise,res,resolve,reject)
                }catch(err){
                    reject(err)
                }
            })
            const microtask_onrejected = () => nextTick(() => {
                try{
                    let res = onrejected(this.value)
                    resolvePromiseWithResult(returnPromise,res,resolve,reject)
                }catch(err){
                    reject(err)
                }
            })
            if(this.state === STATE.FULFILLED){
                microtask_onfulfilled()
            }else if(this.state === STATE.REJECTED){
                microtask_onrejected()
            }else{
                this.fulfillCallbacks.push(microtask_onfulfilled)
                this.rejectedCallbacks.push(microtask_onrejected)
            }
        })
        return returnPromise
    }

    /**
     * resolve支持链式调用
     * 参数为Promise 返回这个Promise，否则返回新的Promise,
     * */ 
    static resolve = (value) => {
        return value instanceof MyPromise ? value : new MyPromise(resolve => resolve(value))
    }
    /**
     * 返回一个Promise，状态为rejected，value为reason
    */
    static reject = (reason) => {
        return new MyPromise((resolve,reject)=>{
            reject(reason)
        })
    }
 }
