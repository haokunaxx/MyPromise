const STATE = {
    'FULFILLED':'fulfilled',
    'REJECTED':'rejected',
    'PENDING':'pending'
}

class MyPromise{
    constructor(executor){
        this.state = STATE.PENDING
        this.value = undefined
        executor(this.resolve,this.reject)
    }
    resolve = (value) => {
        if(this.state !== STATE.PENDING){
            return
        }
        this.state = STATE.FULFILLED
        this.value = value
    }
    reject = (reason) => {
        if(this.state !== STATE.PENDING){
            return
        }
        this.state = STATE.REJECTED
        this.value = reason
    }
    then(onfulfilled,onrejected){
        if(this.state === STATE.FULFILLED){
            onfulfilled(this.value)
        }else if(this.state === STATE.REJECTED){
            onrejected(this.value)
        }
    }
}


let promise = new MyPromise((resolve,reject)=>{
    console.log('execute')
    resolve(1)
}).then(res=>{
    console.log('then1:',res)
},err=>{
    console.log('err1:',err)
})
console.log(promise)