// deno-lint-ignore-file
/**
 * Adopted from https://github.com/GoogleChromeLabs/carlo/blob/8f2cbfedf381818792017fe53651fe07f270bb96/lib/features/file_info.js
 * which is licensed as follows:
 *
 * Copyright 2018 Google Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

export default function install(hostWindow) {
  let lastFileId = 0;
  self.carol.fileInfo = async (file) => {
    const fileId = ++lastFileId;
    self.carol.fileInfo.files_.set(fileId, file);
    const result = await hostWindow.fileInfo(
      `self.carol.fileInfo.files_.get(${fileId})`,
    );
    self.carol.fileInfo.files_.delete(fileId);
    return result;
  };

  self.carol.fileInfo.files_ = new Map();
}
