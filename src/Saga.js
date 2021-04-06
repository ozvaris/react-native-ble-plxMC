// @flow

import { PermissionsAndroid, Platform } from 'react-native';
import { buffers, eventChannel } from 'redux-saga';
import {
  fork,
  cancel,
  take,
  call,
  put,
  race,
  cancelled,
  actionChannel,
  takeEvery,
} from 'redux-saga/effects';
import {
  log,
  logError,
  updateConnectionState,
  bleStateUpdated,
  testFinished,
  writeFinished,
  type BleStateUpdatedAction,
  type UpdateConnectionStateAction,
  type ConnectAction,
  type ExecuteTestAction,
  type WriteTagAction,
  sensorTagFound,
  ConnectionState,
  bleDevice
} from './Reducer';
import {
  BleManager,
  BleError,
  Device,
  State,
  LogLevel,
  Service,
  Characteristic,
  Descriptor,
  BleErrorCode,
} from 'react-native-ble-plx';
import { SensorTagTests } from './Tests';

export function* bleSaga(): Generator<*, *, *> {
  yield put(log('BLE saga started...'));

  // First step is to create BleManager which should be used as an entry point
  // to all BLE related functionalities
  const manager = new BleManager();
  manager.setLogLevel(LogLevel.Verbose);

  // All below generators are described below...
  yield fork(handleScanning, manager);
  yield fork(handleBleState, manager);
  yield fork(handleConnection, manager);
}

// This generator tracks our BLE state. Based on that we can enable scanning, get rid of devices etc.
// eventChannel allows us to wrap callback based API which can be then conveniently used in sagas.
function* handleBleState(manager: BleManager): Generator<*, *, *> {
  const stateChannel = yield eventChannel((emit) => {
    const subscription = manager.onStateChange((state) => {
      emit(state);
    }, true);
    return () => {
      subscription.remove();
    };
  }, buffers.expanding(1));

  try {
    for (; ;) {
      const newState = yield take(stateChannel);

      yield put(bleStateUpdated(newState));
    }
  } finally {
    if (yield cancelled()) {
      stateChannel.close();
    }
  }
}

// This generator decides if we want to start or stop scanning depending on specific
// events:
// * BLE state is in PoweredOn state
// * Android's permissions for scanning are granted
// * We already scanned device which we wanted
function* handleScanning(manager: BleManager): Generator<*, *, *> {
  var scanTask = null;
  var bleState: $Keys<typeof State> = State.Unknown;
  var connectionState: $Keys<typeof ConnectionState> =
    ConnectionState.DISCONNECTED;

  const channel = yield actionChannel([
    'BLE_STATE_UPDATED',
    'UPDATE_CONNECTION_STATE',
  ]);

  for (; ;) {
    const action:
      | BleStateUpdatedAction
      | UpdateConnectionStateAction = yield take(channel);

    switch (action.type) {
      case 'BLE_STATE_UPDATED':
        bleState = action.state;
        break;
      case 'UPDATE_CONNECTION_STATE':
        connectionState = action.bleDevice.connectionState;
        yield put(log('cs' + connectionState));

        break;
    }

    yield put(log('cs1' + connectionState));
    const enableScanning =
      bleState === State.PoweredOn &&
      (connectionState === ConnectionState.DISCONNECTING ||
        connectionState === ConnectionState.DISCONNECTED);



    if (enableScanning) {
      if (scanTask != null) {
        yield cancel(scanTask);
      }
      scanTask = yield fork(scan, manager);
    } else {
      if (scanTask != null) {
        yield cancel(scanTask);
        scanTask = null;
      }
    }
  }
}

// As long as this generator is working we have enabled scanning functionality.
// When we detect SensorTag device we make it as an active device.
function* scan(manager: BleManager): Generator<*, *, *> {
  if (Platform.OS === 'android' && Platform.Version >= 23) {
    yield put(log('Scanning: Checking permissions...'));
    const enabled = yield call(
      PermissionsAndroid.check,
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    );
    if (!enabled) {
      yield put(log('Scanning: Permissions disabled, showing...'));
      const granted = yield call(
        PermissionsAndroid.request,
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        yield put(log('Scanning: Permissions not granted, aborting...'));
        // TODO: Show error message?
        return;
      }
    }
  }

  yield put(log('Scanning started...'));
  const scanningChannel = yield eventChannel((emit) => {

    manager.startDeviceScan(
      null,
      { allowDuplicates: false, scanMode: 2 },
      (error, scannedDevice) => {
        if (error) {
          emit([error, scannedDevice]);
          return;
        }
        if (scannedDevice != null &&
          (
            //scannedDevice.localName === 'Internet Of Furniture' ||
            //scannedDevice.localName === 'INTERNET ON FURNITURE' ||
            scannedDevice.localName === 'NEBULA' ||
            scannedDevice.localName === 'AURELIAN' //||
            //scannedDevice.localName === 'PARAGON'
          )) {

          emit([error, scannedDevice]);
        }
      },
    );
    return () => {
      manager.stopDeviceScan();
    };
  }, buffers.expanding(1));

  try {
    for (; ;) {
      //yield put(log('looping1...'));
      const [error, scannedDevice]: [?BleError,?Device] = yield take(scanningChannel,);
      if (error != null) {
        yield put(log("Error" + error.message));
      }
      if (scannedDevice != null) {
        yield put(sensorTagFound(scannedDevice));
      }
      //yield put(log('looping2...'));
    }
    yield put(log('Exit loop...'));
  } catch (error) {
    yield put(log(error.message));
  } finally {
    yield put(log('Scanning stopped1...'));
    if (yield cancelled()) {
      yield put(log('Scanning channel close...'));
      scanningChannel.close();

    }
  }
}

function* handleConnection(manager: BleManager): Generator<*, *, *> {


  for (; ;) {
    // Take action
    const { device }: ConnectAction = yield take('CONNECT');
    yield put(log("Connected log. Device id =" + device.id))
    //yield put(log(device))
    yield fork(BleConnect, device)


  }
}

function* BleConnect(device: Device): Generator<*, *, *> {
  var testTask = null;
  var writeTask = null;
  var callDevice: Device


  const disconnectedChannel = yield eventChannel((emit) => {
    const subscription = device.onDisconnected((error) => {
      emit({ type: 'DISCONNECTED', error: error });
    });
    return () => {
      subscription.remove();
    };
  }, buffers.expanding(1));



  const deviceActionChannel = yield actionChannel([
    'DISCONNECT' + device.id,
    'EXECUTE_TEST',
    'WRITE_TAG',
  ]);


  let bleDevice: bleDevice = {
    id: device.id,

  }

  try {
    bleDevice.connectionState = ConnectionState.CONNECTING
    yield put(updateConnectionState(bleDevice));
    yield call([device, device.connect]);
    bleDevice.connectionState = ConnectionState.DISCOVERING;
    yield put(updateConnectionState(bleDevice));
    yield call([device, device.discoverAllServicesAndCharacteristics]);
    bleDevice.connectionState = ConnectionState.CONNECTED;
    yield put(updateConnectionState(bleDevice));

    var ccharacteristic: Characteristic;
    const services: Array<Service> = yield call([device, device.services]);

    for (const service of services) {
      yield put(log('Found service: ' + service.uuid));
      const characteristics: Array<Characteristic> = yield call([
        service,
        service.characteristics,
      ]);
      for (const characteristic of characteristics) {
        if (characteristic.uuid == "6e400003-b5a3-f393-e0a9-e50e24dcca9e") {
          yield put(log('Found characteristic: ' + characteristic.uuid));
          yield put(log('Found characteristic: ' + characteristic.isNotifiable));
          ccharacteristic = characteristic;
        }
      }
    }



    const readChannel = yield eventChannel((emit) => {
      const subscription = ccharacteristic.monitor((error, characteristic) => {
        emit({ type: 'READNOTIFY', error: error, characteristic: characteristic });
      });
      return () => {
        subscription.remove();
      };
    }, buffers.expanding(1));

    for (; ;) {
      yield put(log('waiting response1'));
      const { deviceAction, disconnected, readnotify } = yield race({
        deviceAction: take(deviceActionChannel),
        disconnected: take(disconnectedChannel),
        readnotify: take(readChannel),
      });

      yield put(log('waiting response2'));

      if (deviceAction) {
        if (deviceAction.type === 'DISCONNECT' + device.id) {
          if (deviceAction.device.id === device.id) {
            yield put(log('Disconnected by user...' + device.id));
            bleDevice.connectionState = ConnectionState.DISCONNECTING;
            yield put(updateConnectionState(bleDevice));
            yield call([device, device.cancelConnection]);
            disconnectedChannel.close();
            bleDevice.connectionState = ConnectionState.DISCONNECTED
            yield put(updateConnectionState(bleDevice));
          }
          else {
            yield put(log('Not this device...' + device.id));
            yield put(log('Not this device...' + deviceAction.device.id));


          }
          break;

        }
        if (deviceAction.type === 'EXECUTE_TEST') {
          if (testTask != null) {
            yield cancel(testTask);
          }
          testTask = yield fork(executeTest, device, deviceAction);
        }
        if (deviceAction.type === 'WRITE_TAG') {
          if (writeTask != null) {
            yield cancel(writeTask);
          }
          put(log('writetag.'));
          writeTask = yield fork(writeTag, device, deviceAction);
        }
      }
      else if (disconnected) {
        yield put(log('Disconnected by device...'));
        if (disconnected.error != null) {
          yield put(logError(disconnected.error));
        }
        bleDevice.connectionState = ConnectionState.DISCONNECTED
        yield put(updateConnectionState(bleDevice));

        break;
      }
      else if (readnotify) {
        yield put(log('Read from device...'));
        if (readnotify.error != null) {
          yield put(logError(readnotify.error));
        }
        var c = yield call([readnotify.characteristic, readnotify.characteristic.read]);
        //const value = base64.decode(c.value)
        yield put(log('Got base64 value: ' + c.value));
        //break;
      }
    }
  } catch (error) {
    yield put(logError(error));
  } finally {
    yield put(testFinished());
    yield put(writeFinished());

  }
}

function* executeTest(
  device: Device,
  test: ExecuteTestAction,
): Generator<*, *, *> {
  yield put(log('Executing test: ' + test.id));
  const start = Date.now();
  const result = yield call(SensorTagTests[test.id].execute, device);
  if (result) {
    yield put(
      log('Test finished successfully! (' + (Date.now() - start) + ' ms)'),
    );
  } else {
    yield put(log('Test failed! (' + (Date.now() - start) + ' ms)'));
  }
  yield put(testFinished());
}

function* writeTag(
  device: Device,
  writetag: WriteTagAction,
): Generator<*, *, *> {
  yield put(log('Executing test: ' + writetag.id));
  const start = Date.now();
  const result = yield call(SensorTagTests[writetag.id].execute, device);
  if (result) {
    yield put(
      log('Test finished successfully! (' + (Date.now() - start) + ' ms)'),
    );
  } else {
    yield put(log('Test failed! (' + (Date.now() - start) + ' ms)'));
  }
  yield put(writeFinished());
}
