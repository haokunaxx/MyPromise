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

    catch(onrejected){
        return this.then(undefined,onrejected)
    }

    /**
     * 支持链式调用
     * finally中的回调不接受任何参数
     * 之前的then/catch若有返回值，可在之后的链式调用中获取到
     * 之后的链式调用
    */
    finally(onfinally){
        // 为了能在finally之后的链式调用能获取到finally之前的返回值，需要手动添加回调。
        return this.then(
            res => MyPromise.resolve(onfinally()).then(() => res),
            err => MyPromise.resolve(onfinally()).then(() => { throw err })
        )
    }

    // static resolve = (value) =>  value instanceof MyPromise ? value : (new MyPromise(resolve => resolve(value)))
    static resolve = value => new MyPromise((resolve,reject)=>{
        if(value instanceof MyPromise){
            value.then(resolve,reject)
        }else{
            resolve(value)
        }
    })

    static reject = (reason) => new MyPromise((resolve,reject)=> reject(reason))

    static all(promiseArr){
        return new MyPromise((resolve,reject)=>{
            let ret = [], count = 0, len = promiseArr.length, wasRejected = false ;
            for(let i = 0; i < len; i++){
                promiseArr[i].then(res=>{
                    if(wasRejected)return;
                    ret[i] = res
                    count++
                    if(count === len){
                        return resolve(ret)
                    }
                },err=>{
                    wasRejected = true
                    reject(err)
                })
            }
        })
    }

    static race(promiseArr){
        return new MyPromise((resolve,reject)=>{
            let wasSettled = false,
                len = promiseArr.length
            for(let i = 0; i < len; i++){
                promiseArr[i].then(res=>{
                    if(wasSettled)return;
                    wasSettled = true
                    resolve(res)
                },err=>{
                    if(wasSettled)return
                    wasSettled = true
                    reject(err)
                })
            }
        })
    }

    static any(promiseArr){
        return new MyPromise((resolve,reject)=>{
            let count = 0,
                len = promiseArr.length,
                errTip = 'AggregateError: All promises were rejected',
                wasResolved = false
            for(let i = 0; i < len; i++){
                promiseArr[i].then(res=>{
                    if(wasResolved)return;
                    wasResolved = true
                    resolve(res)
                },err=>{
                    if(wasResolved)return;
                    count++
                    if(count === len){
                        reject(errTip)
                    }
                })
            }
        })
    }
    
 }


    //  let res = new Promise((resolve,reject)=>{
    //     setTimeout(()=>{
    //         // resolve('myPromise1')
    //         reject('myReject1')
    //     },1000)
    // }).then(res=>{
    //     console.log('then:',res)
    //     return res
    // }).finally(()=>{
    //     console.log('finally')
    // }).then(res=>console.log('then after finally:',res))

    // console.log(res)

// let res = new MyPromise((resolve,reject)=>{
//     setTimeout(()=>{
//         // resolve('myPromise1')
//         reject('myReject1')
//     },1000)
// }).then(res=>{
//     console.log('then:',res)
//     return res
// })
// console.log(res)
// .finally(()=>{
//     console.log('finally')
// }).then(res=>console.log('then after finally:',res))

// console.log(res)

