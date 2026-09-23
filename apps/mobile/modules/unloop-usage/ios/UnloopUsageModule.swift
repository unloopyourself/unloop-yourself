import ExpoModulesCore

public class UnloopUsageModule: Module {
  public func definition() -> ModuleDefinition {
    Name("UnloopUsage")

    Function("hasUsagePermission") { () -> Bool in
      return false
    }

    Function("openUsageAccessSettings") { () in
      // iOS Screen Time path lands in Phase 2.
    }

    Function("getUsageMsForPackage") { (_packageName: String, _startMs: Double, _endMs: Double) -> Double in
      return -1
    }
  }
}
