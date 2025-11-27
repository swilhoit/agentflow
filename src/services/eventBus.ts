import { EventEmitter } from 'events';
import { logger } from '../utils/logger';

export enum EventType {
  MARKET_UPDATE = 'market_update',
  FINANCIAL_ALERT = 'financial_alert',
  SYSTEM_STATUS = 'system_status',
  DEPLOYMENT_STATUS = 'deployment_status',
  AGENT_TASK_COMPLETED = 'agent_task_completed'
}

export interface AgentEvent {
  type: EventType;
  source: string;
  timestamp: Date;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  payload: any;
}

/**
 * Central Event Bus for Inter-Agent Communication
 * Allows agents to subscribe to events from other agents without direct coupling.
 */
export class EventBus extends EventEmitter {
  private static instance: EventBus;

  private constructor() {
    super();
    this.setMaxListeners(20); // Allow more listeners
  }

  static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  /**
   * Publish an event to the bus
   */
  publish(type: EventType, source: string, severity: AgentEvent['severity'], payload: any): void {
    const event: AgentEvent = {
      type,
      source,
      timestamp: new Date(),
      severity,
      payload
    };
    
    logger.debug(`📡 [EventBus] ${source} -> ${type} (${severity})`);
    this.emit(type, event);
    this.emit('*', event); // Wildcard listener
  }

  /**
   * Subscribe to a specific event type
   */
  subscribe(type: EventType, handler: (event: AgentEvent) => void): void {
    this.on(type, handler);
  }

  /**
   * Subscribe to all events
   */
  subscribeAll(handler: (event: AgentEvent) => void): void {
    this.on('*', handler);
  }
}

