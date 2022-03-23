const STATE = {
    'FULFILLED':'fulfilled',
    'REJECTED':'rejected',
    'PENDING':'pending'
}

/**
 * then执行时如果当前promise的状态还未settled，则收集对应的回调，等到settled后执行（resolve/reject执行）
 * then执行时如果当前promise的状态是fulfilled/rejected，则异步执行回调
 * 
 * 关于then的链式调用：
 *      第一个then执行时机取决于new Promise的状态（settled立即异步执行，pending保存回调）
 *      下一个then的执行时机取决于上一个then返回的Promise的settled时的状态
 * 
 * 下个then执行根据当前then返回的Promise的返回值判断：https://promisesaplus.com，大白话在下面resolvePromiseWithResult代码前
*/

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


/**
 * 
 * 返回值x和resolvePromise进行判断，相同则以异常拒绝promise：reject(new TypeError('Chaining cycle detected for promise #<Promise>'))
 * 如果返回值x是个对象或者是个funciton
 *  如果x===null，用x完成promise
 *  取x的then方法 =》 报错则reject报错原因
 *  then是方法则执行then方法,并且需要加锁限制执行
 *      then.call(resolvePromise,result=>{
 *          //result为then执行结果
 *          resolvePromiseWithResult(resolvePromise,result,resolve,reject)
 *      },err=>reject(err))
 *  then不是方法则用x为完成promise
 * 返回值x不是个对象或函数则用x完成promise
 *  */
function resolvePromiseWithResult(resolvePromise,x,resolve,reject){
    if(x === resolvePromise){
        return reject(new TypeError('Chaining cycle detected for promise #<Promise>'))
    }
    //简单判断，但是promise a+规范测试会报错
    // if(x instanceof MyPromise){
    //     return x.then(resolve,reject)
    // }else{
    //     resolve(x)
    // }
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
            //下个then的结果依托于resolvePromise，resolvePromise的状态在下一行这个then状态敲定时敲定。
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
                // nextTick(() => onfulfilled(this.value))
                // //上面优化成下面
                // nextTick(() => {
                //     let res = onfulfilled(this.value)
                //     resolvePromiseWithResult(returnPromise,res,resolve,reject)
                // })
                // //上面优化成下面
                microtask_onfulfilled()
            }else if(this.state === STATE.REJECTED){
                // nextTick(() => onrejected(this.value))
                microtask_onrejected()
            }else{
                this.resolveCallbacks.push(microtask_onfulfilled)
                this.rejectedCallbacks.push(microtask_onrejected)
            }
        })
        return returnPromise
    }
}


let promise = new MyPromise((resolve,reject)=>{
    setTimeout(()=>{
        // resolve(1)
        reject('err')
    },1000)
    // resolve(1)
    // reject('err-1')
})
let promise1 = promise.then(res=>{
    console.log('then1:',res)
    return new MyPromise((resolve,reject)=>{
        setTimeout(()=>{
            // resolve('11')
            reject('err11')
        },1000)
    })
},err=>{
    console.log('err1:',err)
    return 'err2'
})

let promise2 = promise1.then(res=>{
    console.log('then2:',res)
},err=>{
    console.log('err2:',err)
})


console.log(promise1 == promise2)

console.log('1')