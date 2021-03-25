// @flow

import { State, Device, BleError } from 'react-native-ble-plx';

export type Action =
  | LogAction
  | ClearLogsAction
  | ConnectAction
  | DisconnectAction
  | UpdateConnectionStateAction
  | BleStateUpdatedAction
  | SensorTagFoundAction
  | ForgetSensorTagAction
  | ExecuteTestAction
  | TestFinishedAction
  | ClearDevicesAction
  | StartScanAction;

export type StartScanAction = {|
  type: 'START_SCAN',      
  |};
export type LogAction = {|
  type: 'LOG',
    message: string,
|};

export type ClearLogsAction = {|
  type: 'CLEAR_LOGS',
|};

export type ClearDevicesAction = {|
  type: 'CLEAR_DEVICES',
|};

export type ConnectAction = {|
  type: 'CONNECT',
    device: Device,
|};

export type DisconnectAction = {|
  type: 'DISCONNECT',
|};

export type UpdateConnectionStateAction = {|
  type: 'UPDATE_CONNECTION_STATE',
    bleDevice: bleDevice
      |};

export type BleStateUpdatedAction = {|
  type: 'BLE_STATE_UPDATED',
    state: $Keys < typeof State >,
|};

export type SensorTagFoundAction = {|
  type: 'SENSOR_TAG_FOUND',
    device: Device,
|};

export type ForgetSensorTagAction = {|
  type: 'FORGET_SENSOR_TAG',
|};

export type ExecuteTestAction = {|
  type: 'EXECUTE_TEST',
    id: string,
|};

export type TestFinishedAction = {|
  type: 'TEST_FINISHED',
|};

export type ReduxState = {
  logs: Array<string>,
  currentTest: ?string,
  bleState: $Keys<typeof State>,
  bleDevices: Array<bleDevice>,
};

export const ConnectionState = {
  DISCONNECTED: 'DISCONNECTED',
  CONNECTING: 'CONNECTING',
  DISCOVERING: 'DISCOVERING',
  CONNECTED: 'CONNECTED',
  DISCONNECTING: 'DISCONNECTING',
};

export type bleDevice = {
  type: 'bleDevice',
  activeError: ?BleErro,
  device: ?Device,
  connectionState: $Keys<typeof ConnectionState>,
  id: ?string,
  localName: ?string

}

export const initialState: ReduxState = {
  bleState: State.Unknown,
  currentTest: null,
  logs: [],
  bleDevices: [],
};

export function log(message: string): LogAction {
  return {
    type: 'LOG',
    message,
  };
}

export function logError(error: BleError) {
  return log(
    'ERROR: ' +
    error.message +
    ', ATT: ' +
    (error.attErrorCode || 'null') +
    ', iOS: ' +
    (error.iosErrorCode || 'null') +
    ', android: ' +
    (error.androidErrorCode || 'null') +
    ', reason: ' +
    (error.reason || 'null'),
  );
}

export function clearLogs(): ClearLogsAction {
  return {
    type: 'CLEAR_LOGS',
  };
}

export function clearDevices(): ClearDevicesAction {
  return {
    type: 'CLEAR_DEVICES',
  };
}

export function connect(device: Device): ConnectAction {
  return {
    type: 'CONNECT',
    device,
  };
}

export function blStartScan(device: Device): StartScanAction {
  return {
    type: 'START_SCAN',
    device,
  };
}

export function updateConnectionState(bleDevice: bleDevice,): UpdateConnectionStateAction {
  return {
    type: 'UPDATE_CONNECTION_STATE',
    bleDevice
  };
}

export function disconnect(): DisconnectAction {
  return {
    type: 'DISCONNECT',
  };
}


export function bleStateUpdated(
  state: $Keys<typeof State>,
): BleStateUpdatedAction {
  return {
    type: 'BLE_STATE_UPDATED',
    state,
  };
}

export function sensorTagFound(device: Device): SensorTagFoundAction {
  return {
    type: 'SENSOR_TAG_FOUND',
    device,
  };
}

export function forgetSensorTag(): ForgetSensorTagAction {
  return {
    type: 'FORGET_SENSOR_TAG',
  };
}

export function executeTest(id: string): ExecuteTestAction {
  return {
    type: 'EXECUTE_TEST',
    id,
  };
}

export function testFinished(): TestFinishedAction {
  return {
    type: 'TEST_FINISHED',
  };
}

export function reducer(
  state: ReduxState = initialState,
  action: Action,
): ReduxState {
  switch (action.type) {
    case 'LOG':
      //console.log(action.message)
      return { ...state, logs: [action.message, ...state.logs] };
    case 'CLEAR_LOGS':
      return { ...state, logs: [] };
    case 'CLEAR_DEVICES':
      return { ...state, bleDevices: [] };
    case 'UPDATE_CONNECTION_STATE':
      //console.log("UPDATE_CONNECTION_STATE");
      //console.log(action.bleDevice);
      var newData = state.bleDevices.map(el => {
        if (el.id == action.bleDevice.id)
          return Object.assign({}, el, { connectionState: action.bleDevice.connectionState })
        return el
      });
      return {
        ...state,
        bleDevices: newData,
        logs: ['Connection state changed: ' + action.bleDevice.connectionState, ...state.logs],
      };
    case 'BLE_STATE_UPDATED':
      return {
        ...state,
        bleState: action.state,
        logs: ['BLE state changed: ' + action.state, ...state.logs],
      };
    case 'SENSOR_TAG_FOUND':

      //if (state.activeSensorTag) return state;
      //console.log("TESTSS" + state.bleDevices.length);
      let _bleDevices = [...state.bleDevices];

      for (i = 0; i < state.bleDevices.length; i++) {
        //console.log("bleDevices");
        //console.log(state);
        if (_bleDevices[i].localName == action.device.localName) {
          return state;
        }
      }

      //console.log(action.device)


      let _bleDevice: bleDevice = {
        activeError: null,
        connectionState: ConnectionState.DISCONNECTED,
        id: action.device.id,
        localName: action.device.localName,
        device: action.device
      };



      _bleDevices.push(_bleDevice);

      //console.log("bleDevices1");
      //console.log(_bleDevice);

      // let _bleDevice = {
      //   activeError: null,
      //   activeSensorTag: null,
      //   activeconnectionState: ConnectionState.DISCONNECTED,
      //   DeviceId: null
      // };


      return {
        ...state,
        logs: ['SensorTag found: ' + action.device.localName + " " + action.device.id, ...state.logs],
        bleDevices: _bleDevices,
      };
    case 'FORGET_SENSOR_TAG':
      return {
        ...state,
        activeSensorTag: null,
      };
    case 'EXECUTE_TEST':
      if (state.connectionState !== ConnectionState.CONNECTED) {
        return state;
      }
      return { ...state, currentTest: action.id };
    case 'TEST_FINISHED':
      return { ...state, currentTest: null };
    default:
      return state;
  }
}
