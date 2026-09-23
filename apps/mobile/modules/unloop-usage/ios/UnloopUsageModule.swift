import ExpoModulesCore

public class UnloopUsageModule: Module {
  public func definition() -> ModuleDefinition {
    Name("UnloopUsage")

    Events("onThresholdReached")

    Function("hasUsagePermission") { () -> Bool in
      return false
    }

    Function("openUsageAccessSettings") { () in
      // iOS Screen Time path lands in Phase 2.
    }

    Function("getUsageMsForPackage") { (_packageName: String, _startMs: Double, _endMs: Double) -> Double in
      return -1
    }

    Function("bringAppToForeground") { () in
      // no-op on iOS stub
    }

    Function("startNativeMonitoring") { (_packageName: String, _thresholdMs: Double) in
      // no-op on iOS stub
    }

    Function("stopNativeMonitoring") { () in
      // no-op
    }
  }
}
