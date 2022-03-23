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

    static resolve = (value) =>  value instanceof MyPromise ? value : new MyPromise(resolve => resolve(value))

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


let promise1 = new Promise((resolve,reject)=>{
    setTimeout(()=>{
        resolve('promise1')
    },1000)
})
let promise2 = new Promise((resolve,reject)=>{
    setTimeout(()=>{
       resolve('promise2')
    },2000)
})
let promise3 = new Promise((resolve,reject)=>{
    setTimeout(()=>{
        // console.log(222)
       resolve('promise3')
        // resolve('promise3')
    },3000)
})
let promise4 = new Promise((resolve,reject)=>{
    setTimeout(()=>{
    //    resolve('promise4')
        resolve('promise4')
    },4000)
})

// Promise.all([promise1,promise2,promise3,promise4]).then(res=>console.log(res),err=>console.log('err:',err))
// Promise.race([promise1,promise2,promise3,promise4]).then(res=>console.log(res),err=>console.log('err:',err))
// Promise.any([promise1,promise2,promise3,promise4]).then(res=>console.log(res),err=>console.log('err:',err))




let myPromise1 = new MyPromise((resolve,reject)=>{
    setTimeout(()=>{
        resolve('myPromise1')
        // reject('myPromise1')
    },1000)
})
let myPromise2 = new MyPromise((resolve,reject)=>{
    setTimeout(()=>{
       resolve('myPromise2')
    //    reject('myPromise2')
    },2000)
})
let myPromise3 = new MyPromise((resolve,reject)=>{
    setTimeout(()=>{
    //    reject('myPromise3')
        resolve('myPromise3')
    },4000)
})
let myPromise4 = new MyPromise((resolve,reject)=>{
    setTimeout(()=>{
        // console.log(222)
       resolve('myPromise4')
    // reject('myPromise4')
    },3000)
})
MyPromise.all([myPromise1,myPromise2,myPromise3,myPromise4]).then(res=>console.log(res),err=>console.log('err:',err))
// MyPromise.race([myPromise1,myPromise2,myPromise3,myPromise4]).then(res=>console.log(res),err=>console.log('err:',err))
// MyPromise.any([myPromise1,myPromise2,myPromise3,myPromise4]).then(res=>console.log(res),err=>console.log('err:',err))