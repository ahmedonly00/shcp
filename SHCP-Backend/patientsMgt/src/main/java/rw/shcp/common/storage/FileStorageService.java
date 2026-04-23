package rw.shcp.common.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import rw.shcp.common.exception.AppException;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Set;
import java.util.UUID;

@Service
public class FileStorageService {

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of(
            "pdf", "jpg", "jpeg", "png", "gif", "webp", "bmp", "tiff", "tif", "svg"
    );

    private static final Set<String> ALLOWED_RECORDING_EXTENSIONS = Set.of(
            "webm", "mp4", "ogg"
    );

    private final Path uploadRoot;

    public FileStorageService(@Value("${app.upload.dir:./uploads}") String uploadDir) {
        this.uploadRoot = Paths.get(uploadDir).toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.uploadRoot);
        } catch (IOException e) {
            throw new RuntimeException("Could not initialise upload directory: " + uploadDir, e);
        }
    }

    /**
     * Store a file under uploads/{userId}/ and return the stored filename.
     */
    public String store(MultipartFile file, UUID userId) throws IOException {
        String original = file.getOriginalFilename() != null ? file.getOriginalFilename() : "file";
        String extension = extractExtension(original).toLowerCase();

        if (!ALLOWED_EXTENSIONS.contains(extension)) {
            throw AppException.badRequest("File type not allowed. Accepted: PDF, JPG, PNG, GIF, WEBP, BMP, TIFF, SVG");
        }

        Path userDir = uploadRoot.resolve(userId.toString());
        Files.createDirectories(userDir);

        String storedName = UUID.randomUUID() + "." + extension;
        Path destination = userDir.resolve(storedName);
        Files.copy(file.getInputStream(), destination, StandardCopyOption.REPLACE_EXISTING);
        return storedName;
    }

    /**
     * Store a consultation recording under uploads/recordings/{consultationId}/.
     * Only webm, mp4, ogg are accepted.
     */
    public String storeRecording(MultipartFile file, UUID consultationId) throws IOException {
        String original = file.getOriginalFilename() != null ? file.getOriginalFilename() : "recording";
        String extension = extractExtension(original).toLowerCase();

        if (!ALLOWED_RECORDING_EXTENSIONS.contains(extension)) {
            throw AppException.badRequest("Recording type not allowed. Accepted: webm, mp4, ogg");
        }

        Path recordingDir = uploadRoot.resolve("recordings").resolve(consultationId.toString());
        Files.createDirectories(recordingDir);

        String storedName = UUID.randomUUID() + "." + extension;
        Path destination = recordingDir.resolve(storedName);
        Files.copy(file.getInputStream(), destination, StandardCopyOption.REPLACE_EXISTING);
        return storedName;
    }

    /**
     * Load a previously stored file as a Spring Resource.
     */
    public Resource load(String storedName, UUID userId) {
        try {
            Path filePath = uploadRoot.resolve(userId.toString()).resolve(storedName).normalize();
            // Prevent path traversal
            if (!filePath.startsWith(uploadRoot.resolve(userId.toString()))) {
                throw AppException.badRequest("Invalid file path");
            }
            Resource resource = new UrlResource(filePath.toUri());
            if (!resource.exists() || !resource.isReadable()) {
                throw AppException.notFound("File not found: " + storedName);
            }
            return resource;
        } catch (MalformedURLException e) {
            throw AppException.notFound("File not found: " + storedName);
        }
    }

    /**
     * Load a consultation recording as a Spring Resource.
     */
    public Resource loadRecording(UUID consultationId, String storedName) {
        try {
            Path recordingDir = uploadRoot.resolve("recordings").resolve(consultationId.toString());
            Path filePath = recordingDir.resolve(storedName).normalize();
            // Prevent path traversal
            if (!filePath.startsWith(recordingDir)) {
                throw AppException.badRequest("Invalid file path");
            }
            Resource resource = new UrlResource(filePath.toUri());
            if (!resource.exists() || !resource.isReadable()) {
                throw AppException.notFound("Recording not found");
            }
            return resource;
        } catch (MalformedURLException e) {
            throw AppException.notFound("Recording not found");
        }
    }

    private static String extractExtension(String filename) {
        int dot = filename.lastIndexOf('.');
        return (dot >= 0 && dot < filename.length() - 1) ? filename.substring(dot + 1) : "";
    }
}
