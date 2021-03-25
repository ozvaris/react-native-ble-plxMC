// @flow

import React, { Component } from 'react';
import { connect as reduxConnect } from 'react-redux';
import {
  StyleSheet,
  Text,
  SafeAreaView,
  View,
  FlatList,
  TouchableOpacity,
  Modal,
  StatusBar,
} from 'react-native';
import {
  type ReduxState,
  clearDevices,
  clearLogs,
  connect,
  disconnect,
  executeTest,
  forgetSensorTag,
  ConnectionState,
  bleDevice
} from './Reducer';
import { Device, State as bleState } from 'react-native-ble-plx';
import { SensorTagTests, type SensorTagTestMetadata } from './Tests';

const Button = function (props) {
  const { onPress, title, ...restProps } = props;
  return (
    <TouchableOpacity onPress={onPress} {...restProps}>
      <Text
        style={[
          styles.buttonStyle,
          restProps.disabled ? styles.disabledButtonStyle : null,
        ]}>
        {title}
      </Text>
    </TouchableOpacity>
  );
};

type Props = {
  sensorTag: ?Device,
  connectionState: $Keys<typeof ConnectionState>,
  logs: Array<string>,
  clearLogs: typeof clearLogs,
  connect: typeof connect,
  disconnect: typeof disconnect,
  executeTest: typeof executeTest,
  currentTest: ?string,
  forgetSensorTag: typeof forgetSensorTag,
  bleDevices: Array<bleDevice>
};

type State = {
  showModal: boolean,
};

class SensorTag extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      showModal: false,
    };
  }

  sensorTagStatus(_bleDevice): string {
    if (this.props.bleState === bleState.PoweredOn) {
      switch (_bleDevice.connectionState) {
        case ConnectionState.CONNECTING:
          return 'Connecting...';
        case ConnectionState.DISCOVERING:
          return 'Discovering...';
        case ConnectionState.CONNECTED:
          return 'Connected';
        case ConnectionState.DISCONNECTED:
        case ConnectionState.DISCONNECTING:
          if (_bleDevice.device) {
            return 'Found ' + _bleDevice.device.id;
          }
      }
    }



    return 'Searching...';
  }

  isSensorTagReadyToConnect(_bleDevice): boolean {
    //console.log("_bleDevice");
    //console.log(_bleDevice.connectionState);
    return (
      this.props.bleState === bleState.PoweredOn && _bleDevice.connectionState === ConnectionState.DISCONNECTED
    );
  }

  isSensorTagReadyToDisconnect(_bleDevice): boolean {
    return this.props.bleState === bleState.PoweredOn && _bleDevice.connectionState === ConnectionState.CONNECTED;
  }

  isSensorTagReadyToExecuteTests(_bleDevice): boolean {
    return (
      bleDevice.connectionState === ConnectionState.CONNECTED &&
      this.props.currentTest == null
    );
  }

  renderHeader() {
    return (
      <View style={{ padding: 10 }}>
        <Text style={styles.textStyle} numberOfLines={1}>
          BleState: {this.props.bleState} DevicesCount: {this.props.bleDevices.length}
        </Text>
        {this.props.bleDevices.map(
          (bleDevice) =>
            <View key={bleDevice.id} style={{ padding: 1 }}>
              <Text style={styles.textStyle} numberOfLines={1}>
                Name: {bleDevice.localName}
              </Text>
              <View style={{ flexDirection: 'row', paddingTop: 5 }}>
                <Button
                  disabled={!this.isSensorTagReadyToConnect(bleDevice)}
                  style={{ flex: 1 }}
                  onPress={() => {
                    if (bleDevice.device) {
                      //console.log(bleDevice.device);
                      this.props.connect(bleDevice.device);
                    }
                  }}
                  title={'Connect'}
                />
                <View style={{ width: 5 }} />
                <Button
                  disabled={!this.isSensorTagReadyToDisconnect(bleDevice)}
                  style={{ flex: 1 }}
                  onPress={() => {
                    this.props.disconnect(bleDevice.device);
                  }}
                  title={'Disconnect'}
                />
              </View>
            </View>
        )}

      </View>


    );
  }

  renderLogs() {
    return (
      <View style={{ flex: 1, padding: 10, paddingTop: 0 }}>
        <FlatList
          style={{ flex: 1 }}
          data={this.props.logs}
          renderItem={({ item }) => (
            <Text style={styles.logTextStyle}> {item} </Text>
          )}
          keyExtractor={(item, index) => index.toString()}
        />
        <Button
          style={{ paddingTop: 10 }}
          onPress={() => {
            this.props.clearDevices();
          }}
          title={'Clear Devices'}
        />
        <Button
          style={{ paddingTop: 10 }}
          onPress={() => {
            this.props.clearLogs();
          }}
          title={'Clear logs'}
        />
      </View>
    );
  }

  renderModal() {
    // $FlowFixMe: SensorTagTests are keeping SensorTagTestMetadata as values.
    const tests: Array<SensorTagTestMetadata> = Object.values(SensorTagTests);

    return (
      <Modal
        animationType="fade"
        transparent={true}
        visible={this.state.showModal}
        onRequestClose={() => { }}>
        <View
          style={{
            backgroundColor: '#00000060',
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <View
            style={{
              backgroundColor: '#2a24fb',
              borderRadius: 10,
              height: '50%',
              padding: 5,
              shadowColor: 'black',
              shadowRadius: 20,
              shadowOpacity: 0.9,
              elevation: 20,
            }}>
            <Text
              style={[
                styles.textStyle,
                { paddingBottom: 10, alignSelf: 'center' },
              ]}>
              Select test to execute:
            </Text>
            <FlatList
              data={tests}
              renderItem={({ item }) => (
                <Button
                  style={{ paddingBottom: 5 }}
                  disabled={!this.isSensorTagReadyToExecuteTests(_bleDevice)}
                  onPress={() => {
                    this.props.executeTest(item.id);
                    this.setState({ showModal: false });
                  }}
                  title={item.title}
                />
              )}
              keyExtractor={(item, index) => index.toString()}
            />
            <Button
              style={{ paddingTop: 5 }}
              onPress={() => {
                this.setState({ showModal: false });
              }}
              title={'Cancel'}
            />
          </View>
        </View>
      </Modal>
    );
  }

  render() {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#15127e" />
        {this.renderHeader()}
        {this.renderLogs()}
        {this.renderModal()}
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2924fb',
    padding: 5,
  },
  textStyle: {
    color: 'white',
    fontSize: 20,
  },
  logTextStyle: {
    color: 'white',
    fontSize: 9,
  },
  buttonStyle: {
    borderWidth: 1,
    borderRadius: 5,
    padding: 5,
    backgroundColor: '#15127e',
    color: 'white',
    textAlign: 'center',
    fontSize: 20,
  },
  disabledButtonStyle: {
    backgroundColor: '#15142d',
    color: '#919191',
  },
});

export default reduxConnect(
  (state: ReduxState): $Shape<Props> => ({
    logs: state.logs,
    currentTest: state.currentTest,
    bleState: state.bleState,
    bleDevices: state.bleDevices
  }),
  {
    clearDevices,
    clearLogs,
    connect,
    disconnect,
    forgetSensorTag,
    executeTest,
  },
)(SensorTag);
