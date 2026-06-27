import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import FirebaseCore
import GoogleMaps
import react_native_ota_hot_update

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    FirebaseApp.configure()

    // react-native-maps PROVIDER_GOOGLE on iOS — Maps SDK key. Android uses the
    // AndroidManifest meta-data key; both are restricted to "Maps SDK" in Google Cloud.
    GMSServices.provideAPIKey("AIzaSyB4jJpH1-3SYsBGguA9UqHcwGs-AC_bpuw")

    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)
    // Orange background so the brief gap between LaunchScreen.storyboard
    // and React Native's first paint shows the splash color, not black.
    let splashOrange = UIColor(red: 254.0/255.0, green: 158.0/255.0, blue: 47.0/255.0, alpha: 1.0)
    window?.backgroundColor = splashOrange

    factory.startReactNative(
      withModuleName: "TiffsyConsumer",
      in: window,
      launchOptions: launchOptions
    )

    window?.rootViewController?.view.backgroundColor = splashOrange

    return true
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    // react-native-ota-hot-update: load the OTA JS bundle when installed,
    // otherwise the embedded bundle.
    OtaHotUpdate.getBundle()
#endif
  }
}
