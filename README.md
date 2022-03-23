
# 手撸一个符合Promise A+规范的Promise

## 掘金地址 [手撸一个符合Promise A+规范的Promise](https://juejin.cn/post/7078238639779479589)

## 前言

​	废话改天再说，但是看了**点个赞吧**🫣感谢

## 编写基本结构代码

```JavaScript
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
        if(this.state !== STATE.PENDING)return;
        this.state = STATE.FULFILLED
        this.value = value
    }
    reject = (reason) => {
        if(this.state !== STATE.PENDING)return;
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
```

## 工具函数： 添加一个microtask

```javascript
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
```

## then方法

### 收集异步回调

then执行时如果当前promise的状态还未settled，则收集对应的回调（**处理过，执行时也是异步执行**），等到settled后执行（resolve/reject执行）

### 异步执行回调

then执行时如果当前promise的状态是fulfilled/rejected，则异步执行回调

### 链式调用

第一个then执行时机取决于new Promise的状态（settled立即异步执行，pending保存回调）

下一个then的执行时机取决于上一个then返回的Promise的settled时的状态

### 下个then执行时机说明

**下一个then方法绑定的回调在上一个then返回的promise的状态settled的时候执行。**

因此可以设置对then绑定的回调进行简单判断：then绑定的回调执行的结果是promise实例则在此实例状态改变的时候修改then方法返回的promise的状态。（注意要区分**then方法绑定的回调执行结果的promise**和**then方法返回的用于链式调用的promise**）

```javascript
//简单判断，但是promise a+规范测试会报错
if(x instanceof MyPromise){
     return x.then(resolve,reject)
}else{
     resolve(x)
}
```

但是promise aplus对此又更加细致的划分：

### resolvePromiseWithResult代码

**下个then执行根据当前then返回的Promise的返回值判断逻辑**（resolvePromiseWithResult）

首先官方的文档在这 [promise aplus规范](https://promisesaplus.com)，**大白话翻译在下面**

 * then(onfulfilled,onrejected)中参数执行的返回值`x`和then方法返回的promise`resolvePromise`进行判断，相同则以异常拒绝`promise：reject(new TypeError('Chaining cycle detected for promise #<Promise>'))`

 * 如果返回值x是个对象或者是个funciton
	 *  如果`x===null`，用`x`完成promise

	 *  取`x`的`then`方法 

		 *  如果报错则`reject`报错原因
		 * `then`是方法则执行`then`方法,并且需要加锁限制执行

		```javascript
		then.call(resolvePromise,result=>{
			 //result为then执行结果
			 resolvePromiseWithResult(resolvePromise,result,resolve,reject)
		 },err=>reject(err))
		```

		 *  `then`不是方法，则用`x`完成promise

 * 返回值`x`不是个对象或函数，则用`x`完成promise

最后处理then返回的逻辑代码如下：

```javascript
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
            //下个then的结果依托于resolvePromise，resolvePromise的状态在下一行这个then状态敲定时敲定。
            try{
                then.call(x,_res => {
                    if(called){return}
                    called = true
                    resolvePromiseWithResult(resolvePromise,_res,resolve,reject)
                },_err=>{
                    if(called){return}
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
```

### then代码

```javascript
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
            // nextTick(() => onfulfilled(this.value)) //无法判断结果
            // nextTick(() => {
            //     let res = onfulfilled(this.value)
            //     resolvePromiseWithResult(returnPromise,res,resolve,reject)
            // })
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
```

### 构造函数添加回调缓存池

```javascript
constructor(executor){
    //...
    this.resolveCallbacks = []
    this.rejectedCallbacks = []
    //...
}
```

### resolve和reject方法

对resolve和reject方法进行补充，使之执行的时候（状态已被敲定）将相应的回调拿出执行。

```javascript
resolve = (value) => {
    if(this.state !== STATE.PENDING)return;
    this.state = STATE.FULFILLED
    this.value = value
    while(this.resolveCallbacks.length > 0){
        this.resolveCallbacks.shift()(value)
    }
}
reject = (reason) => {
    if(this.state !== STATE.PENDING)return;
    this.state = STATE.REJECTED
    this.value = reason
    while(this.rejectedCallbacks.length > 0){
        this.rejectedCallbacks.shift()(reason)
    }
}
```

## promise a-plus测试

### 测试准备

使用 promises-aplus-tests 进行测试。步骤如下：

* `npm init -y`

* `npm install promise-aplus-tests -D`

* 修改package.json文件，如下，需要修改成自己对应的文件路径

	```javascript
	"main": "4.promise-aplus-test-success.js",
	"scripts": {
	    "test": "promises-aplus-tests 4.promise-aplus-test-success"
	},
	```

* 往我们的Promise中以下添加代码

	```javascript
	MyPromise.deferred = function () {
	    var result = {};
	    result.promise = new MyPromise(function (resolve, reject) {
	        result.resolve = resolve;
	        result.reject = reject;
	    });
	    return result;
	}
	module.exports = MyPromise;
	```

### 执行测试

* 执行测试`npm run test`
* 测试不通过😰

### 出现报错

测试完成后控制台发现一百多个报错哈哈。仔细看报错会发现：

```javascript
// 报错1. Both `onFulfilled` and `onRejected` are optional arguments. 2.2.1.1: If `onFulfilled` is not a function, it must be ignored. applied to a promise rejected and then chained off of `onFulfilled` is `undefined`
// 报错2. `then` must return a promise: `promise2 = promise1.then(onFulfilled, onRejected)` 2.2.7.2: If either `onFulfilled` or `onRejected` throws an exception `e`, `promise2` must be rejected with `e` as the reason. The reason is an error already-rejected:
```

其实报错原因就两个，大白话说就是：

1. 没有对then方法的参数进行容错处理，参数为空的情况下没有进行处理
2. then传入的回调执行时如果报错没有进行异常处理

### then方法调整，添加错误捕获

```javascript
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
```

### constructor

发现构造函数中执行器也没有进行错误捕获🙈一起添加以下

```javascript
constructor(executor){
	//...
    try{
        executor(this.resolve,this.reject)
    }catch(err){
        this.reject(err)
    }
}
```

### 再次测试，测试通过。

## Promise.resolve/reject

#### Promise.resolve

特征：**Promise.resolve支持链式调用 => 返回为Promise**

测试代码

```javascript
let p1 = new Promise((resolve,reject)=>{
	setTimeout(()=>{
        resolve(1)
    },1000)
})
let p2 = Promise.resolve(p1)
console.log(p1 === p2)
```

执行上面代码会发现：控制台输出`true`

所以得出第二个特征：**参数为Promise 返回这个Promise，否则返回新的Promise**

```javascript
static resolve = (value) => value instanceof MyPromise ? value : new MyPromise(resolve => resolve(value))
```

#### Promise.reject

特征：**返回一个Promise，状态为rejected，value为参数**

```javascript
static reject = (reason) => new MyPromise((resolve,reject) => reject(reason))
```

## Promise.race/all/any

### Promise.race

* 参数为一个Promise构成的数组
* 返回一个promise
* 返回promise的状态由参数数组中第一个settled的promise决定

```javascript
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
```

### Promise.all

* 参数为一个Promise构成的数组
* 返回一个promise
* 参数中的每一个Promise都为fulfilled时，返回的promise的状态为`fulfilled`，并且返回值value为每个promise执行的结果（**按参数promise顺序保存在数组中**）
* 参数中第一个状态变成`rejected`将会导致`promise.all`返回的promise `state`为`rejected`并且返回值value为`rejected`的promise `reject`的值

```javascript
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
```

### Promise.any

* 参数为一个Promise构成的数组
* 返回一个promise
* 参数数组中如果有一个promise状态改变为`fulfilled`，此时`Promise.any`返回的promise `state`为`fulfilled`，`value`为这个promise `resolve`的值，
* 如果参数数组中所有的promise都rejected的话，此时Promise.any返回的promise `state`为rejected，`value`为一个错误提示`'AggregateError: All promises were rejected'`

```javascript
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
```

## catch/finally方法

### catch方法

```javascript
catch(onrejected){
    return this.then(undefined,onrejected)
}
```

### finally方法

特征：

* 支持链式调用，返回的Promise状态为`fulfilled`

* finally中的回调不接受任何参数

* 之前的then/catch若有返回值，可在之后的链式调用中获取到

```javascript
finally(onfinally){
    // 为了能在finally之后的链式调用能获取到finally之前的返回值，需要手动添加回调。
    return this.then(
        res => MyPromise.resolve(onfinally()).then(() => res),
        err => MyPromise.resolve(onfinally()).then(() => { throw err })
    )
}
```

## 源码

代码稍后将会更新到 [github仓库](https://github.com/haokunaxx) 中去

代码每个步骤都有单个文件，每个文件也有对应的注释，同时会有一个最终版的代码在项目下。

有问题欢迎留言指出，也欢迎互相学习进步。

