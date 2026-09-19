require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', '..', '..', 'package.json')))

# NOTE: the pod must NOT be named 'AlarmKit'. Expo autolinking derives the Swift
# module name from the pod name and writes `import <podName>` into the generated
# ExpoModulesProvider; 'AlarmKit' would resolve to Apple's own framework, where
# AlarmKitModule does not exist.
Pod::Spec.new do |s|
  s.name           = 'AnimsaAlarmKit'
  s.version        = package['version']
  s.summary        = 'AlarmKit bridge for Animsa'
  s.description    = 'Schedules real iOS alarms that ring through silent mode and Focus.'
  s.license        = { :type => 'MIT' }
  s.author         = 'Baris Coskun'
  s.homepage       = 'https://github.com/Bariscompeng/animsa'
  s.platforms      = { :ios => '26.0' }
  # Required: without it CocoaPods does not set up Swift compilation at all, so
  # the target builds with no sources and the module silently does not exist.
  s.swift_version  = '5.9'
  s.source         = { git: 'https://github.com/Bariscompeng/animsa.git' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
