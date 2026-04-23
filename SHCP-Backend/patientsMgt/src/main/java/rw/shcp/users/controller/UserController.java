package rw.shcp.users.controller;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import rw.shcp.common.exception.AppException;
import rw.shcp.common.response.ApiResponse;
import rw.shcp.common.storage.FileStorageService;
import rw.shcp.common.util.SecurityUtils;
import rw.shcp.users.model.User;
import rw.shcp.users.repository.UserRepository;

import java.io.IOException;
import java.util.UUID;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
@Tag(name = "Users", description = "Shared user operations (avatar upload)")
public class UserController {

    private final FileStorageService fileStorageService;
    private final UserRepository     userRepository;

    @PostMapping(value = "/me/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Upload or replace profile picture")
    public ResponseEntity<ApiResponse<String>> uploadAvatar(
            @RequestPart("file") MultipartFile file) throws IOException {

        UUID userId = SecurityUtils.currentUserId();
        String storedName = fileStorageService.store(file, userId);

        User user = userRepository.findById(userId)
                .orElseThrow(() -> AppException.notFound("User not found"));
        user.setProfilePictureUrl(storedName);
        userRepository.save(user);

        return ResponseEntity.ok(ApiResponse.ok(storedName));
    }

    @GetMapping("/me/files/{filename}")
    @PreAuthorize("isAuthenticated()")
    @Operation(summary = "Serve a user-uploaded file (avatar or other)")
    public ResponseEntity<Resource> getFile(@PathVariable String filename) {
        UUID userId = SecurityUtils.currentUserId();
        Resource resource = fileStorageService.load(filename, userId);

        String lower = filename.toLowerCase();
        String contentType;
        if (lower.endsWith(".pdf"))       contentType = "application/pdf";
        else if (lower.endsWith(".png"))  contentType = "image/png";
        else if (lower.endsWith(".gif"))  contentType = "image/gif";
        else if (lower.endsWith(".webp")) contentType = "image/webp";
        else if (lower.endsWith(".svg"))  contentType = "image/svg+xml";
        else                              contentType = "image/jpeg";

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + filename + "\"")
                .contentType(MediaType.parseMediaType(contentType))
                .body(resource);
    }
}
