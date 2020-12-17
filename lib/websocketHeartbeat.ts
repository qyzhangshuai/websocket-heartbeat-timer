/* eslint-disable class-methods-use-this */
/* eslint-disable no-empty-function */
/* eslint-disable prettier/prettier */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-empty-function */
import { websocketHeartbeatOpts, websocketHeartbeatOptsInit , myWebsocket } from './types'
// import { getUUID } from './util/index'

class WebsocketHeartbeat {
  public opts: websocketHeartbeatOpts = websocketHeartbeatOptsInit
  private ws: myWebsocket = null // WebSocket
  private _repeat = 0
  // 前端发送ping消息，后端收到后，需要立刻返回pong消息
  private _pingTimeoutId: NodeJS.Timer | null = null
  private _pongTimeoutId: NodeJS.Timer | null = null
  private _lockReconnect = false
  private _forbidReconnect = false
  public uuid = ''

  private get msg():string {
    return JSON.stringify({
      msg: this.opts.pingMsg,
      uuid: this.uuid ,
      ...this.opts.userInfo
    })
  }

  constructor(opts: websocketHeartbeatOpts) {
    Object.assign(this.opts, opts)
    if (!this.opts.manualStart) {
      this.createWebSocket()
    }
  }
  public onclose(): void {}
  public onerror(): void {}
  public onopen(): void {}
  public onstart(): void {}
  public onstop(): void {}
  // WebSocket.onmessage 属性是一个当收到来自服务器的消息时被调用的 EventHandler
  public onmessage(event: any): void {}
  public onreconnect(): void {}

  public start(): void {
    this.heartStart(this.onstart)
  }

  public stop(): void {
    this.heartReset(this.onstop)
  }

  public send(msg: string): void {
    if (!this.ws) return
    this.ws.send(JSON.stringify({msg, uuid: this.uuid ,...this.opts.userInfo}))
  }

  public close(): void {
    // 如果手动关闭连接，不再重连
    if (!this.ws) return
    this._forbidReconnect = true
    this.heartReset();
    this.onclose()
    this.ws.close()
  }

  public createWebSocket(): void {
    try {
      this.ws = new WebSocket(this.opts.url)
      this.initEventHandle()
      this._forbidReconnect = false
    } catch (e) {
      this.reconnect()
      throw e
    }
  }

  public reconnect(): void {
    if (
      (this.opts.repeatLimit as number) > 0 &&
      (this.opts.repeatLimit as number) <= this._repeat
    ) {
      return
    }
    if (this._lockReconnect || this._forbidReconnect) return
    this._lockReconnect = true
    this._repeat++
    this.onreconnect()
    setTimeout(() => {
      this.createWebSocket()
      this._lockReconnect = false
    }, this.opts.reconnectTimeout)
  }

  private initEventHandle(): void {
    if (!this.ws) return
    this.ws.onclose = () => {
      this.onclose()
      this.reconnect()
    }
    this.ws.onerror = () => {
      this.onerror()
      this.reconnect()
    }
    this.ws.onopen = () => {
      this._repeat = 0
      this.onopen()
      // 心跳检测重置
      this.heartCheck()
    }
    this.ws.onmessage = (event: any) => {
      this.onmessage(event)
      this.heartCheck()
    }
  }

  private heartStart(fn = function(){}): void {
    if (this._forbidReconnect) return // 不再重连就不再执行心跳
    this.heartReset()
    this.ws && !this._forbidReconnect && fn()
    this._pingTimeoutId = setTimeout(() => {
      if (!this.ws) return
      this.ws.send(this.msg)
      this._pongTimeoutId = setTimeout(() => {
        if (!this.ws) return
        this.ws.close()
      }, this.opts.pongTimeout)
    }, this.opts.pingTimeout)
  }
  
  private heartCheck(): void {
    this.heartReset()
    this.heartStart()
  }

  private heartReset(fn = function(){}): void {
    this.ws && !this._forbidReconnect && fn()
    this._pingTimeoutId && clearTimeout(this._pingTimeoutId)
    this._pongTimeoutId && clearTimeout(this._pongTimeoutId)
  }
}

export default WebsocketHeartbeat