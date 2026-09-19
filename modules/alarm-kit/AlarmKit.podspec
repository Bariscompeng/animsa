require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'AlarmKit'
  s.version        = package['version']
  s.summary        = 'AlarmKit bridge for Animsa'
  s.description    = 'Schedules real iOS alarms that ring through silent mode and Focus.'
  s.author         = 'Baris Coskun'
  s.homepage       = 'https://github.com/bariscoskun/animsa'
  s.platforms      = { :ios => '26.0' }
  s.source         = { git: '' }
  s.static_framework = true
  s.license        = { :type => 'MIT' }

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
