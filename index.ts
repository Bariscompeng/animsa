// Background task definitions must be registered at module scope, before the
// router entry point is evaluated, so iOS can dispatch geofencing and
// background-task events into a cold-started JS runtime.
import './src/background/tasks';
import 'expo-router/entry';
